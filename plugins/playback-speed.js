/**
 * @name Playback Speed
 * @author zxcloli666 / soundcloud-rpc port
 * @version 1.4.0
 * @description Slow down or speed up SoundCloud playback from 0.50x to 2.00x, with optional pitch preservation.
 * @license MIT
 * @homepage https://github.com/zxcloli666/SoundCloud-Desktop
 */

const MIN_RATE = 0.5;
const MAX_RATE = 2;
const RATE_STEP = 0.05;
const DEFAULT_RATE = 1;

module.exports = {
    onEnable() {
        console.log('Playback Speed enabled');
    },

    onDisable() {
        console.log('Playback Speed disabled');
    },

    contentScript() {
        return `
(function() {
    if (window.__scrpcPlaybackSpeedLoaded) {
        window.__scrpcPlaybackSpeedApi?.apply();
        return;
    }
    window.__scrpcPlaybackSpeedLoaded = true;

    var MIN_RATE = ${MIN_RATE};
    var MAX_RATE = ${MAX_RATE};
    var RATE_STEP = ${RATE_STEP};
    var DEFAULT_RATE = ${DEFAULT_RATE};
    var STORAGE_KEY = 'scrpc-playback-speed-settings';
    var HOST_ID = 'scrpc-playback-speed-host';
    var PANEL_HOST_ID = 'scrpc-playback-speed-panel-host';
    var mountedHost = null;
    var panelHost = null;
    var shadowRoot = null;
    var panelShadowRoot = null;
    var panel = null;
    var toggleButton = null;
    var valueButton = null;
    var rateSlider = null;
    var pitchToggle = null;
    var observer = null;
    var mountFrame = 0;
    var positionFrame = 0;
    var domReadyHandler = null;
    var trackedMedia = new Set();
    var patchedMediaMethods = [];
    var originalCurrentTimeDescriptor = null;
    var patchedCurrentTimeGetter = null;
    var patchedCurrentTimeSetter = null;
    var originalAudioDescriptor = null;
    var originalAudioConstructor = null;
    var patchedAudioConstructor = null;
    var restoringMedia = false;

    var language = String(document.documentElement.lang || navigator.language || 'en').toLowerCase();
    var isRussian = language.indexOf('ru') === 0;
    var text = isRussian
        ? {
            title: 'Скорость воспроизведения',
            reset: 'Сбросить до 1.00×',
            pitch: 'Тональность следует за скоростью',
            hint: 'Колесо мыши меняет скорость с шагом 0.05',
            button: 'Скорость воспроизведения',
            slower: 'Медленнее',
            faster: 'Быстрее'
        }
        : {
            title: 'Playback speed',
            reset: 'Reset to 1.00×',
            pitch: 'Pitch follows speed',
            hint: 'Use the mouse wheel to change by 0.05',
            button: 'Playback speed',
            slower: 'Slower',
            faster: 'Faster'
        };

    function clampRate(value) {
        var numeric = Number(value);
        if (!Number.isFinite(numeric)) return DEFAULT_RATE;
        return Math.round(Math.max(MIN_RATE, Math.min(MAX_RATE, numeric)) * 100) / 100;
    }

    function formatRate(value) {
        return clampRate(value)
            .toFixed(2)
            .replace(/\\.00$/, '')
            .replace(/(\\.\\d)0$/, '$1') + '×';
    }

    function readSettings() {
        try {
            var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return {
                rate: clampRate(parsed.rate),
                pitchFollows: typeof parsed.pitchFollows === 'boolean' ? parsed.pitchFollows : true
            };
        } catch (error) {
            return { rate: DEFAULT_RATE, pitchFollows: true };
        }
    }

    var state = readSettings();

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.warn('[playback-speed] Could not save settings:', error);
        }
    }

    function setPitchPreservation(media, shouldPreserve) {
        ['preservesPitch', 'webkitPreservesPitch', 'mozPreservesPitch'].forEach(function(property) {
            try {
                if (property in media && media[property] !== shouldPreserve) {
                    media[property] = shouldPreserve;
                }
            } catch (error) {}
        });
    }

    function isAudioMedia(media) {
        return Boolean(media && media.tagName === 'AUDIO' && typeof media.playbackRate === 'number');
    }

    function applyToMedia(media) {
        if (!isAudioMedia(media)) return;
        try {
            setPitchPreservation(media, !state.pitchFollows);
            if (Math.abs(media.defaultPlaybackRate - state.rate) > 0.001) {
                media.defaultPlaybackRate = state.rate;
            }
            if (Math.abs(media.playbackRate - state.rate) > 0.001) {
                media.playbackRate = state.rate;
            }
        } catch (error) {
            console.warn('[playback-speed] Could not update audio element:', error);
        }
    }

    function onTrackedMediaRateChange(event) {
        if (!restoringMedia) applyToMedia(event.currentTarget);
    }

    function forgetOldestMedia() {
        if (trackedMedia.size < 8) return;
        var oldest = trackedMedia.values().next().value;
        if (!oldest) return;
        oldest.removeEventListener('ratechange', onTrackedMediaRateChange);
        trackedMedia.delete(oldest);
    }

    function rememberMedia(media) {
        if (!isAudioMedia(media)) return media;
        if (trackedMedia.has(media)) return media;

        forgetOldestMedia();
        trackedMedia.add(media);
        media.addEventListener('ratechange', onTrackedMediaRateChange);
        applyToMedia(media);
        return media;
    }

    function applyToAllMedia() {
        trackedMedia.forEach(applyToMedia);
        document.querySelectorAll('audio').forEach(rememberMedia);
    }

    function patchMediaMethod(prototype, name) {
        var descriptor = Object.getOwnPropertyDescriptor(prototype, name);
        if (!descriptor || typeof descriptor.value !== 'function' || descriptor.configurable === false) return;

        var original = descriptor.value;
        var patched = function() {
            rememberMedia(this);
            return original.apply(this, arguments);
        };

        try {
            Object.defineProperty(prototype, name, { ...descriptor, value: patched });
            patchedMediaMethods.push({ prototype: prototype, name: name, original: descriptor, patched: patched });
        } catch (error) {
            console.warn('[playback-speed] Could not patch media method ' + name + ':', error);
        }
    }

    function installCurrentTimeHook(prototype) {
        var descriptor = Object.getOwnPropertyDescriptor(prototype, 'currentTime');
        if (!descriptor || !descriptor.get || descriptor.configurable === false) return;

        originalCurrentTimeDescriptor = descriptor;
        patchedCurrentTimeGetter = function() {
            rememberMedia(this);
            return descriptor.get.call(this);
        };
        patchedCurrentTimeSetter = descriptor.set
            ? function(value) {
                rememberMedia(this);
                return descriptor.set.call(this, value);
            }
            : undefined;

        try {
            Object.defineProperty(prototype, 'currentTime', {
                ...descriptor,
                get: patchedCurrentTimeGetter,
                set: patchedCurrentTimeSetter
            });
        } catch (error) {
            originalCurrentTimeDescriptor = null;
            patchedCurrentTimeGetter = null;
            patchedCurrentTimeSetter = null;
            console.warn('[playback-speed] Could not patch media currentTime:', error);
        }
    }

    function installAudioConstructorHook() {
        originalAudioDescriptor = Object.getOwnPropertyDescriptor(window, 'Audio');
        originalAudioConstructor = window.Audio;
        if (typeof originalAudioConstructor !== 'function' || typeof Proxy !== 'function') return;

        patchedAudioConstructor = new Proxy(originalAudioConstructor, {
            apply: function(target, thisArg, args) {
                return rememberMedia(Reflect.apply(target, thisArg, args));
            },
            construct: function(target, args, newTarget) {
                return rememberMedia(Reflect.construct(target, args, newTarget));
            }
        });

        try {
            if (originalAudioDescriptor) {
                Object.defineProperty(window, 'Audio', {
                    ...originalAudioDescriptor,
                    value: patchedAudioConstructor
                });
            } else {
                window.Audio = patchedAudioConstructor;
            }
        } catch (error) {
            patchedAudioConstructor = null;
            console.warn('[playback-speed] Could not patch Audio constructor:', error);
        }
    }

    function installMediaHooks() {
        var prototype = window.HTMLMediaElement?.prototype;
        if (!prototype) return;

        patchMediaMethod(prototype, 'play');
        patchMediaMethod(prototype, 'pause');
        patchMediaMethod(prototype, 'load');
        installCurrentTimeHook(prototype);
        installAudioConstructorHook();
    }

    function restoreMediaHooks() {
        patchedMediaMethods.forEach(function(entry) {
            var current = Object.getOwnPropertyDescriptor(entry.prototype, entry.name);
            if (current?.value === entry.patched) {
                try {
                    Object.defineProperty(entry.prototype, entry.name, entry.original);
                } catch (error) {}
            }
        });
        patchedMediaMethods = [];

        if (originalCurrentTimeDescriptor && patchedCurrentTimeGetter) {
            var prototype = window.HTMLMediaElement?.prototype;
            var currentTime = prototype
                ? Object.getOwnPropertyDescriptor(prototype, 'currentTime')
                : null;
            if (
                prototype &&
                currentTime?.get === patchedCurrentTimeGetter &&
                currentTime?.set === patchedCurrentTimeSetter
            ) {
                try {
                    Object.defineProperty(prototype, 'currentTime', originalCurrentTimeDescriptor);
                } catch (error) {}
            }
        }

        if (patchedAudioConstructor && window.Audio === patchedAudioConstructor) {
            try {
                if (originalAudioDescriptor) {
                    Object.defineProperty(window, 'Audio', originalAudioDescriptor);
                } else {
                    window.Audio = originalAudioConstructor;
                }
            } catch (error) {}
        }
    }

    function updateUi() {
        var formatted = formatRate(state.rate);
        if (toggleButton) {
            toggleButton.textContent = formatted;
            toggleButton.title = text.button + ': ' + formatted;
            toggleButton.setAttribute('aria-label', text.button + ': ' + formatted);
            toggleButton.classList.toggle('is-active', Math.abs(state.rate - DEFAULT_RATE) > 0.001);
        }
        if (valueButton) {
            valueButton.textContent = formatted;
            valueButton.title = text.reset;
            valueButton.classList.toggle('is-active', Math.abs(state.rate - DEFAULT_RATE) > 0.001);
        }
        if (rateSlider) {
            rateSlider.value = String(state.rate);
            rateSlider.style.setProperty(
                '--fill',
                ((state.rate - MIN_RATE) / (MAX_RATE - MIN_RATE)) * 100 + '%'
            );
        }
        if (pitchToggle) pitchToggle.checked = state.pitchFollows;
        if (panelShadowRoot) {
            panelShadowRoot.querySelectorAll('[data-rate]').forEach(function(button) {
                var preset = clampRate(button.getAttribute('data-rate'));
                button.classList.toggle('is-selected', Math.abs(preset - state.rate) < 0.001);
            });
        }
    }

    function setRate(value, persist) {
        state.rate = clampRate(value);
        if (persist !== false) saveSettings();
        updateUi();
        applyToAllMedia();
    }

    function setPitchFollows(value, persist) {
        state.pitchFollows = Boolean(value);
        if (persist !== false) saveSettings();
        updateUi();
        applyToAllMedia();
    }

    function adjustRate(direction) {
        setRate(state.rate + direction * RATE_STEP);
    }

    function onMediaEvent(event) {
        rememberMedia(event.target);
    }

    function closePanel() {
        if (!panel || panel.hidden) return;
        panel.hidden = true;
        panelHost?.setAttribute('data-open', 'false');
        panelHost?.setAttribute('aria-hidden', 'true');
        toggleButton?.setAttribute('aria-expanded', 'false');
    }

    function positionPanel() {
        if (!panel || panel.hidden || !toggleButton) return;
        cancelAnimationFrame(positionFrame);
        positionFrame = requestAnimationFrame(function() {
            var anchor = toggleButton.getBoundingClientRect();
            var panelWidth = panel.offsetWidth || 300;
            var panelHeight = panel.offsetHeight || 250;
            var left = Math.min(window.innerWidth - panelWidth - 12, Math.max(12, anchor.right - panelWidth));
            var top = anchor.top - panelHeight - 10;
            if (top < 12) top = Math.min(window.innerHeight - panelHeight - 12, anchor.bottom + 10);
            panel.style.left = Math.max(12, left) + 'px';
            panel.style.top = Math.max(12, top) + 'px';
        });
    }

    function openPanel() {
        if (!panel) return;
        panel.hidden = false;
        panelHost?.setAttribute('data-open', 'true');
        panelHost?.removeAttribute('aria-hidden');
        toggleButton?.setAttribute('aria-expanded', 'true');
        positionPanel();
    }

    function togglePanel() {
        if (!panel) return;
        if (panel.hidden) openPanel();
        else closePanel();
    }

    function onDocumentPointerDown(event) {
        if (!mountedHost || panel?.hidden) return;
        var path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        if (path.indexOf(mountedHost) === -1 && path.indexOf(panelHost) === -1) closePanel();
    }

    function onDocumentKeyDown(event) {
        if (event.key === 'Escape') closePanel();
    }

    function onRateWheel(event) {
        if (event.ctrlKey || event.metaKey) return;
        if (event.cancelable) event.preventDefault();
        adjustRate(event.deltaY < 0 ? 1 : -1);
    }

    function createUi(host) {
        shadowRoot = host.attachShadow({ mode: 'open' });
        shadowRoot.innerHTML = \`
            <style>
                :host {
                    display: inline-flex;
                    align-items: center;
                    align-self: center;
                    position: relative;
                    z-index: 1000;
                    margin: 0 0 0 10px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
                    font-synthesis: none;
                    text-rendering: optimizeLegibility;
                    color: #f2f2f2;
                }
                :host([data-fallback]) {
                    position: fixed;
                    right: 16px;
                    bottom: 58px;
                    z-index: 2147483646;
                    margin: 0;
                }
                * {
                    box-sizing: border-box;
                    font-family: inherit;
                }
                .toggle {
                    min-width: 42px;
                    height: 32px;
                    padding: 0 8px;
                    border: 1px solid rgba(255, 255, 255, 0.16);
                    border-radius: 16px;
                    background: linear-gradient(180deg, rgba(42, 42, 42, 0.96), rgba(25, 25, 25, 0.96));
                    color: rgba(255, 255, 255, 0.72);
                    font-size: 11px;
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    line-height: 30px;
                    letter-spacing: -0.01em;
                    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.24);
                    cursor: pointer;
                    transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
                }
                .toggle:hover,
                .toggle:focus-visible,
                .toggle.is-active {
                    color: #fff;
                    border-color: rgba(255, 85, 0, 0.65);
                    background: linear-gradient(180deg, rgba(255, 92, 20, 0.24), rgba(255, 85, 0, 0.12));
                    outline: none;
                }
            </style>
            <button class="toggle" type="button" aria-haspopup="dialog" aria-expanded="false"></button>
        \`;

        document.getElementById(PANEL_HOST_ID)?.remove();
        panelHost = document.createElement('div');
        panelHost.id = PANEL_HOST_ID;
        panelHost.setAttribute('data-open', 'false');
        panelHost.setAttribute('aria-hidden', 'true');
        panelHost.style.cssText =
            'all:initial!important;display:block!important;position:fixed!important;' +
            'inset:0!important;width:auto!important;height:auto!important;margin:0!important;' +
            'padding:0!important;border:0!important;background:transparent!important;' +
            'pointer-events:none!important;overflow:visible!important;line-height:normal!important;' +
            'z-index:2147483647!important;';
        document.body.appendChild(panelHost);
        panelShadowRoot = panelHost.attachShadow({ mode: 'open' });
        panelShadowRoot.innerHTML = \`
            <style>
                :host {
                    all: initial;
                    display: block;
                    position: fixed;
                    inset: 0;
                    z-index: 2147483647;
                    width: auto;
                    height: auto;
                    margin: 0;
                    padding: 0;
                    border: 0;
                    background: transparent;
                    pointer-events: none;
                    overflow: visible;
                    line-height: normal;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
                    font-synthesis: none;
                    text-rendering: optimizeLegibility;
                    color: #f2f2f2;
                }
                :host([data-open="false"]) .panel {
                    display: none !important;
                }
                * {
                    box-sizing: border-box;
                    font-family: inherit;
                }
                button, input { font: inherit; }
                button { color: inherit; }
                [hidden] { display: none !important; }
                .panel {
                    position: fixed;
                    z-index: 2147483647;
                    width: min(300px, calc(100vw - 24px));
                    padding: 16px;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
                    border: 1px solid rgba(255, 255, 255, 0.11);
                    border-radius: 14px;
                    background: linear-gradient(145deg, rgba(36, 36, 36, 0.99), rgba(18, 18, 18, 0.99));
                    box-shadow: 0 20px 64px rgba(0, 0, 0, 0.58), 0 1px 0 rgba(255, 255, 255, 0.04) inset;
                    backdrop-filter: blur(18px);
                    pointer-events: auto;
                    overflow: hidden;
                    animation: panel-in 120ms ease-out;
                }
                @keyframes panel-in {
                    from { opacity: 0; transform: translateY(5px) scale(0.985); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 13px;
                }
                .title {
                    min-width: 0;
                    color: rgba(255, 255, 255, 0.88);
                    font-size: 13px;
                    font-weight: 600;
                    line-height: 1.25;
                    letter-spacing: -0.012em;
                }
                .value {
                    min-width: 52px;
                    padding: 5px 8px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 9px;
                    background: rgba(255, 255, 255, 0.045);
                    color: rgba(255, 255, 255, 0.68);
                    font-size: 12px;
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    text-align: right;
                    cursor: pointer;
                }
                .value.is-active,
                .value:hover {
                    border-color: rgba(255, 85, 0, 0.35);
                    background: rgba(255, 85, 0, 0.10);
                    color: #ff7a32;
                }
                .rate-row {
                    display: grid;
                    grid-template-columns: 30px minmax(0, 1fr) 30px;
                    align-items: center;
                    gap: 8px;
                    margin: 5px 0 14px;
                }
                .slider {
                    --fill: 33.333%;
                    appearance: none;
                    display: block;
                    width: 100%;
                    height: 18px;
                    margin: 0;
                    background: transparent;
                    cursor: pointer;
                }
                .slider::-webkit-slider-runnable-track {
                    height: 4px;
                    border-radius: 999px;
                    background: linear-gradient(90deg, #ff5500 0 var(--fill), rgba(255, 255, 255, 0.18) var(--fill) 100%);
                }
                .slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    margin-top: -6px;
                    border: 3px solid #ff650f;
                    border-radius: 50%;
                    background: #fff;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.38);
                }
                .slider:focus-visible { outline: none; }
                .slider:focus-visible::-webkit-slider-thumb {
                    box-shadow: 0 0 0 3px rgba(255, 85, 0, 0.24), 0 2px 8px rgba(0, 0, 0, 0.38);
                }
                .step {
                    width: 32px;
                    height: 32px;
                    padding: 0;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.055);
                    color: rgba(255, 255, 255, 0.72);
                    font-size: 17px;
                    line-height: 30px;
                    cursor: pointer;
                }
                .step:hover,
                .step:focus-visible {
                    border-color: rgba(255, 85, 0, 0.56);
                    background: rgba(255, 85, 0, 0.14);
                    color: #fff;
                    outline: none;
                }
                .presets {
                    display: grid;
                    grid-template-columns: repeat(6, minmax(0, 1fr));
                    gap: 6px;
                }
                .preset {
                    min-width: 0;
                    height: 30px;
                    padding: 0 2px;
                    border: 1px solid rgba(255, 255, 255, 0.10);
                    border-radius: 9px;
                    background: rgba(255, 255, 255, 0.045);
                    color: rgba(255, 255, 255, 0.62);
                    font-size: 10.5px;
                    font-weight: 600;
                    font-variant-numeric: tabular-nums;
                    cursor: pointer;
                }
                .preset:hover,
                .preset:focus-visible,
                .preset.is-selected {
                    border-color: rgba(255, 85, 0, 0.56);
                    background: rgba(255, 85, 0, 0.14);
                    color: #fff;
                    outline: none;
                }
                .pitch-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-top: 14px;
                    padding-top: 13px;
                    border-top: 1px solid rgba(255, 255, 255, 0.08);
                    color: rgba(255, 255, 255, 0.72);
                    font-size: 11.5px;
                    font-weight: 500;
                    cursor: pointer;
                }
                .pitch-row input {
                    appearance: none;
                    position: relative;
                    flex: 0 0 auto;
                    width: 34px;
                    height: 19px;
                    margin: 0;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.10);
                    cursor: pointer;
                    transition: border-color 120ms ease, background 120ms ease;
                }
                .pitch-row input::after {
                    content: '';
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 13px;
                    height: 13px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.82);
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
                    transition: transform 120ms ease, background 120ms ease;
                }
                .pitch-row input:checked {
                    border-color: #ff650f;
                    background: #ff5500;
                }
                .pitch-row input:checked::after {
                    transform: translateX(15px);
                    background: #fff;
                }
                .pitch-row input:focus-visible {
                    outline: 3px solid rgba(255, 85, 0, 0.22);
                }
                .hint {
                    margin: 11px 0 0;
                    color: rgba(255, 255, 255, 0.40);
                    font-size: 10.5px;
                    line-height: 1.4;
                }
            </style>
            <section class="panel" role="dialog" hidden>
                <div class="header">
                    <span class="title"></span>
                    <button class="value" type="button"></button>
                </div>
                <div class="rate-row">
                    <button class="step step-down" type="button">−</button>
                    <input class="slider" type="range" min="${MIN_RATE}" max="${MAX_RATE}" step="${RATE_STEP}">
                    <button class="step step-up" type="button">+</button>
                </div>
                <div class="presets">
                    <button class="preset" type="button" data-rate="0.5">0.5×</button>
                    <button class="preset" type="button" data-rate="0.75">0.75×</button>
                    <button class="preset" type="button" data-rate="1">1×</button>
                    <button class="preset" type="button" data-rate="1.25">1.25×</button>
                    <button class="preset" type="button" data-rate="1.5">1.5×</button>
                    <button class="preset" type="button" data-rate="2">2×</button>
                </div>
                <label class="pitch-row">
                    <span class="pitch-label"></span>
                    <input class="pitch-toggle" type="checkbox">
                </label>
                <p class="hint"></p>
            </section>
        \`;

        toggleButton = shadowRoot.querySelector('.toggle');
        panel = panelShadowRoot.querySelector('.panel');
        valueButton = panelShadowRoot.querySelector('.value');
        rateSlider = panelShadowRoot.querySelector('.slider');
        pitchToggle = panelShadowRoot.querySelector('.pitch-toggle');

        panelShadowRoot.querySelector('.title').textContent = text.title;
        panelShadowRoot.querySelector('.pitch-label').textContent = text.pitch;
        panelShadowRoot.querySelector('.hint').textContent = text.hint;
        panelShadowRoot.querySelector('.step-down').title = text.slower;
        panelShadowRoot.querySelector('.step-down').setAttribute('aria-label', text.slower);
        panelShadowRoot.querySelector('.step-up').title = text.faster;
        panelShadowRoot.querySelector('.step-up').setAttribute('aria-label', text.faster);

        toggleButton.addEventListener('click', togglePanel);
        toggleButton.addEventListener('wheel', onRateWheel, { passive: false });
        valueButton.addEventListener('click', function() { setRate(DEFAULT_RATE); });
        panelShadowRoot.querySelector('.step-down').addEventListener('click', function() {
            adjustRate(-1);
        });
        panelShadowRoot.querySelector('.step-up').addEventListener('click', function() {
            adjustRate(1);
        });
        rateSlider.addEventListener('input', function(event) { setRate(event.target.value); });
        rateSlider.addEventListener('wheel', onRateWheel, { passive: false });
        pitchToggle.addEventListener('change', function(event) { setPitchFollows(event.target.checked); });
        panelShadowRoot.querySelectorAll('[data-rate]').forEach(function(button) {
            button.addEventListener('click', function() {
                setRate(button.getAttribute('data-rate'));
            });
        });
        updateUi();
    }

    function findPlayerControls() {
        return document.querySelector(
            '.playControls__controls, .playControls__elements, [class*="playControls"] [class*="controls"]'
        );
    }

    function ensureMounted() {
        mountFrame = 0;
        var controls = findPlayerControls();
        var current = document.getElementById(HOST_ID);

        if (current && current !== mountedHost) current.remove();

        if (!mountedHost || !mountedHost.isConnected) {
            mountedHost = document.createElement('span');
            mountedHost.id = HOST_ID;
            if (controls) controls.appendChild(mountedHost);
            else {
                mountedHost.setAttribute('data-fallback', '');
                document.body?.appendChild(mountedHost);
            }
            createUi(mountedHost);
        } else if (mountedHost.hasAttribute('data-fallback') && controls) {
            mountedHost.removeAttribute('data-fallback');
            controls.appendChild(mountedHost);
        }
    }

    function scheduleMount() {
        if (mountFrame) return;
        mountFrame = requestAnimationFrame(ensureMounted);
    }

    function onMutations(records) {
        records.forEach(function(record) {
            record.addedNodes.forEach(function(node) {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                if (node.tagName === 'AUDIO') rememberMedia(node);
                node.querySelectorAll?.('audio').forEach(rememberMedia);
            });
        });
        if (!mountedHost?.isConnected || mountedHost.hasAttribute('data-fallback')) scheduleMount();
    }

    function start() {
        ensureMounted();
        applyToAllMedia();

        document.addEventListener('play', onMediaEvent, true);
        document.addEventListener('loadedmetadata', onMediaEvent, true);
        document.addEventListener('ratechange', onMediaEvent, true);
        document.addEventListener('pointerdown', onDocumentPointerDown, true);
        document.addEventListener('keydown', onDocumentKeyDown, true);
        window.addEventListener('resize', positionPanel);
        window.addEventListener('scroll', positionPanel, true);

        observer = new MutationObserver(onMutations);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    window.__scrpcPlaybackSpeedApi = {
        getRate: function() { return state.rate; },
        setRate: function(value) { setRate(value); },
        reset: function() { setRate(DEFAULT_RATE); },
        apply: function() {
            applyToAllMedia();
        },
        getTrackedMediaCount: function() { return trackedMedia.size; }
    };

    window.__scrpc_cleanup_playback_speed = function() {
        observer?.disconnect();
        cancelAnimationFrame(mountFrame);
        cancelAnimationFrame(positionFrame);
        if (domReadyHandler) document.removeEventListener('DOMContentLoaded', domReadyHandler);
        document.removeEventListener('play', onMediaEvent, true);
        document.removeEventListener('loadedmetadata', onMediaEvent, true);
        document.removeEventListener('ratechange', onMediaEvent, true);
        document.removeEventListener('pointerdown', onDocumentPointerDown, true);
        document.removeEventListener('keydown', onDocumentKeyDown, true);
        window.removeEventListener('resize', positionPanel);
        window.removeEventListener('scroll', positionPanel, true);

        restoreMediaHooks();
        var mediaToReset = new Set(trackedMedia);
        document.querySelectorAll('audio').forEach(function(media) {
            mediaToReset.add(media);
        });

        restoringMedia = true;
        mediaToReset.forEach(function(media) {
            try {
                media.removeEventListener('ratechange', onTrackedMediaRateChange);
                setPitchPreservation(media, true);
                media.defaultPlaybackRate = DEFAULT_RATE;
                media.playbackRate = DEFAULT_RATE;
            } catch (error) {}
        });
        trackedMedia.clear();
        restoringMedia = false;

        mountedHost?.remove();
        panelHost?.remove();
        panelHost = null;
        panelShadowRoot = null;
        delete window.__scrpcPlaybackSpeedApi;
        delete window.__scrpcPlaybackSpeedLoaded;
        delete window.__scrpc_cleanup_playback_speed;
    };

    if (document.body) start();
    else {
        domReadyHandler = function() {
            domReadyHandler = null;
            start();
        };
        document.addEventListener('DOMContentLoaded', domReadyHandler, { once: true });
    }

    installMediaHooks();
})();
        `;
    },
};
