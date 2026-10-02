import { contextBridge, ipcRenderer } from 'electron';
import type { TrackInfo, TrackUpdateReason } from './types';

contextBridge.exposeInMainWorld('soundcloudAPI', {
    sendTrackUpdate: (data: TrackInfo, reason: TrackUpdateReason) => {
        ipcRenderer.send('soundcloud:track-update', {
            data,
            reason,
        });
    },
});

// A download button at the end of every action row (like, repost, share...), which SoundCloud renders
// under each track in a stream or profile, on each row of an album or playlist, and under the player
// of a track, album or playlist page. Added from here rather than from the page's own world so that
// only this script, and not anything soundcloud.com loads, can start a download.
const DOWNLOAD_ICON =
    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 2.5v8m0 0L4.75 7.25M8 10.5l3.25-3.25M3 13.25h10" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function addDownloadButtons(): void {
    for (const actions of document.querySelectorAll('.soundActions:not(:has(.scrpc-download))')) {
        const size = actions.classList.contains('soundActions__small') ? 'small' : 'medium';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `scrpc-download sc-button-secondary sc-button sc-button-${size} sc-button-icon sc-button-responsive`;
        button.title = 'Download';
        button.setAttribute('aria-label', 'Download');
        button.innerHTML = `<div>${DOWNLOAD_ICON}</div>`;

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!e.isTrusted) return; // a click the page synthesized

            // the row or stream item this button sits in, else the page itself when it is the player's own row
            const link = button
                .closest('.trackItem, .sound, .soundBadge')
                ?.querySelector<HTMLAnchorElement>('a.trackItem__trackTitle, a.soundTitle__title');
            const url = link?.href ?? (button.closest('.listenEngagement') ? location.href : '');
            if (url) ipcRenderer.send('soundcloud:download', url);
        });

        (actions.querySelector('.sc-button-group') ?? actions).append(button);
    }
}

// SoundCloud tags every link it hands out with who shared it (`si`) and where (`utm_*`).
function stripTracking(link: string): string {
    let url: URL;
    try {
        url = new URL(link);
    } catch {
        return link;
    }
    if (!/(^|\.)soundcloud\.com$/.test(url.hostname)) return link;

    // filtered as text: searchParams.delete would re-encode the parameters that stay
    const query = url.search.slice(1);
    const kept = query
        .split('&')
        .filter((param) => !/^(si|utm_\w+)(=|$)/.test(param))
        .join('&');
    if (kept === query) return link;
    url.search = kept;
    return url.href;
}

// "Copy Link" and the share dialog's field both copy through a selection, so one listener covers them
document.addEventListener(
    'copy',
    (e) => {
        const text = String(getSelection()).trim();
        const clean = stripTracking(text);
        if (clean === text) return;
        e.clipboardData?.setData('text/plain', clean);
        e.preventDefault();
    },
    true,
);

// The share dialog's social buttons carry the same link percent-encoded inside their own URL.
// ponytail: assumes every parameter on the nested link is tracking, which holds today; decode and
// reuse stripTracking if SoundCloud ever puts a real one after them.
const ENCODED_TRACKING = /(%3F|%26)(si|utm_[a-z]+)%3D[\w.~-]*/gi;

function cleanShareDialog(): void {
    const field = document.querySelector<HTMLInputElement>('input.shareLink__field');
    // only on change, writing the value back would drop the user's selection
    if (field && stripTracking(field.value) !== field.value) field.value = stripTracking(field.value);

    for (const button of document.querySelectorAll<HTMLAnchorElement>('a.shareButton')) {
        const href = button.getAttribute('href') ?? '';
        const clean = href.replace(ENCODED_TRACKING, '');
        if (clean !== href) button.setAttribute('href', clean);
    }
}

// Tab titles come from what the page shows (track, playlist or profile name) rather than
// document.title, which is localized SEO text, and tab icons from its cover or profile picture.
// Selectors are SoundCloud's hero and profile headers.
// ponytail: polled because SoundCloud swaps pages without a load event, so a title can trail a
// navigation by up to 500ms. Watch the hero with a MutationObserver if that lag ever matters.
let lastPageInfo = '';
setInterval(() => {
    addDownloadButtons();
    cleanShareDialog();

    const text = (selector: string) => document.querySelector<HTMLElement>(selector)?.innerText.trim() ?? '';
    const ownProfile = document.querySelector<HTMLAnchorElement>(
        '.header__userNav [data-menu-name="profile"], .header__userNavUsernameButton',
    );
    // covers and profile pictures are a background image on a span, or on some pages a plain <img>
    const artwork = document.querySelector<HTMLElement>(
        '.fullHero__artwork span.sc-artwork, .fullHero__artwork img, .profileHeaderInfo__avatar span.sc-artwork',
    );
    const info = {
        title: text('.fullHero__title .soundTitle__title'),
        user: text('.fullHero__title .soundTitle__username'),
        profile: text('.profileHeaderInfo__userName'),
        ownProfilePath: ownProfile?.pathname ?? '',
        artwork:
            artwork instanceof HTMLImageElement
                ? artwork.src
                : (/url\("?([^")]+)"?\)/.exec(artwork?.style.backgroundImage ?? '')?.[1] ?? ''),
    };

    const key = JSON.stringify(info);
    if (key === lastPageInfo) return;
    lastPageInfo = key;
    ipcRenderer.send('soundcloud:page-info', info);
}, 500);

// Two-finger trackpad swipes reach the page as horizontal wheel events and Electron has no history
// swiper of its own, so turn them into back/forward. The 3-finger `swipe` event is handled in main.ts.
// Sandboxed preloads can't require local modules, which is why this lives here rather than in utils/.
const SWIPE_PX = 150; // horizontal travel that counts as a swipe; raise if it fires too easily
const SWIPE_GAP_MS = 150; // silence that ends a gesture, momentum events keep one alive

// can a scroller under the pointer still move sideways in this direction?
function canScrollX(e: WheelEvent, direction: number): boolean {
    const { documentElement: html, body } = document;
    const overflowX = (el: Element) => getComputedStyle(el).overflowX;
    // The viewport, which scrolls through <html>, takes <html>'s overflow or <body>'s when <html>'s is
    // visible (soundcloud.com overflows sideways below ~960px this way, and body.scrollLeft stays 0).
    // Unlike other elements, `visible` there still scrolls.
    const bodyGoesToViewport = overflowX(html) === 'visible';
    const viewport = bodyGoesToViewport ? overflowX(body) : overflowX(html);

    for (const node of e.composedPath()) {
        if (!(node instanceof Element) || (node === body && bodyGoesToViewport)) continue;
        const isViewport = node === html;
        const overflow = isViewport ? viewport : overflowX(node);
        if (isViewport ? overflow === 'hidden' || overflow === 'clip' : overflow !== 'auto' && overflow !== 'scroll') {
            continue;
        }
        const max = node.scrollWidth - node.clientWidth;
        if (max > 0 && (direction < 0 ? node.scrollLeft > 0 : node.scrollLeft < max - 1)) return true;
    }
    return false;
}

if (process.platform === 'darwin') {
    let last = 0;
    let dx = 0;
    let dy = 0;
    let ignored = false; // this gesture already navigated, or a scroller owns it
    let checked = false; // scroller check runs once per gesture, on its first horizontal event

    window.addEventListener(
        'wheel',
        (e) => {
            if (e.ctrlKey || e.shiftKey) return; // pinch-zoom, shift-scroll

            if (e.timeStamp - last > SWIPE_GAP_MS) {
                dx = 0;
                dy = 0;
                ignored = false;
                checked = false;
            }
            last = e.timeStamp;
            if (ignored) return;

            if (!checked && e.deltaX) {
                checked = true;
                ignored = canScrollX(e, e.deltaX);
                if (ignored) return;
            }

            dx += e.deltaX;
            dy += e.deltaY;
            if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < 2 * Math.abs(dy)) return;

            ignored = true;
            // same overscroll semantics as Chromium elsewhere: scrolling past the left edge is back
            ipcRenderer.send(dx < 0 ? 'navigate-back' : 'navigate-forward');
        },
        { passive: true },
    );
}
