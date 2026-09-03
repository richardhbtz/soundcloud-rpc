// Settings panel behaviour.
//
// This used to be interpolated into the page as an inline <script>. It lives in a real
// file so the panel can be served under a Content-Security-Policy that refuses inline
// script -- see src/utils/appProtocol.ts.
//
// Loaded as a classic script, so everything here runs in the page's global scope exactly
// as it did before.

const ipcRenderer = {
    send: (channel, ...args) => window.settingsAPI.send(channel, ...args),
    invoke: (channel, ...args) => window.settingsAPI.invoke(channel, ...args),
    on: (channel, listener) => window.settingsAPI.on(channel, (...args) => listener(null, ...args)),
};
const shell = {
    openExternal: (url) => window.settingsAPI.openExternal(url),
    openPath: (targetPath) => window.settingsAPI.openPath(targetPath),
};

// data loading functions
async function loadCustomThemes() {
    try {
        const themes = await ipcRenderer.invoke('get-custom-themes');
        const currentTheme = await ipcRenderer.invoke('get-current-custom-theme');
        const selector = document.getElementById('customThemeSelector');
        if (!selector) return;

        while (selector.children.length > 1) {
            selector.removeChild(selector.lastChild);
        }

        themes.forEach(theme => {
            const option = document.createElement('option');
            option.value = theme.name;
            option.textContent = theme.name;
            selector.appendChild(option);
        });

        selector.value = currentTheme || 'none';
    } catch (error) {
        console.error('Failed to load custom themes:', error);
    }
}

async function loadPlugins() {
    try {
        const plugins = await ipcRenderer.invoke('get-plugins');
        const list = document.getElementById('pluginList');
        if (!list) return;

        list.innerHTML = '';

        if (!plugins || plugins.length === 0) {
            list.innerHTML = '<div class="no-plugins" data-i18n="noPluginsFound">No plugins found</div>';
            return;
        }

        plugins.forEach(p => {
            const card = document.createElement('div');
            card.className = 'plugin-card';
            const hasHomepage = p.metadata.homepage && p.metadata.homepage.trim() !== '';
            const nameClass = hasHomepage ? 'plugin-name has-homepage' : 'plugin-name';

            const header = document.createElement('div');
            header.className = 'plugin-header';

            const spanWrapper = document.createElement('span');
            const nameEl = document.createElement('span');
            nameEl.className = nameClass;
            nameEl.textContent = p.metadata.name || p.id;
            if (hasHomepage) {
                nameEl.dataset.homepage = p.metadata.homepage;
                nameEl.title = 'Open homepage';
                nameEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    ipcRenderer.send('show-plugin-homepage-dialog', nameEl.dataset.homepage);
                });
            }
            spanWrapper.appendChild(nameEl);

            const versionEl = document.createElement('span');
            versionEl.className = 'plugin-version';
            versionEl.textContent = 'v' + (p.metadata.version || '?');
            spanWrapper.appendChild(versionEl);
            header.appendChild(spanWrapper);

            const toggle = document.createElement('label');
            toggle.className = 'toggle';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.pluginId = p.id;
            checkbox.checked = p.enabled;
            checkbox.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                await ipcRenderer.invoke('set-plugin-enabled', p.id, enabled);
            });
            const slider = document.createElement('span');
            slider.className = 'slider';
            toggle.appendChild(checkbox);
            toggle.appendChild(slider);
            header.appendChild(toggle);
            card.appendChild(header);

            if (p.metadata.description) {
                const descEl = document.createElement('div');
                descEl.className = 'plugin-desc';
                descEl.textContent = p.metadata.description;
                card.appendChild(descEl);
            }

            if (p.metadata.author && p.metadata.author !== 'Unknown') {
                const authorEl = document.createElement('div');
                authorEl.className = 'plugin-author';
                authorEl.textContent = 'by ' + p.metadata.author;
                card.appendChild(authorEl);
            }

            list.appendChild(card);
        });
    } catch (error) {
        console.error('Failed to load plugins:', error);
    }
}

async function loadAccounts() {
    try {
        const data = await ipcRenderer.invoke('get-accounts');
        const selector = document.getElementById('accountSelector');
        if (!selector) return;

        selector.innerHTML = '';
        data.accounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.id;
            option.textContent = acc.name;
            selector.appendChild(option);
        });
        selector.value = data.currentAccountId || 'default';
    } catch(e) { 
        console.error('Failed to load accounts:', e); 
    }
}

// initilization
document.addEventListener('DOMContentLoaded', () => {
    loadCustomThemes();
    loadPlugins();
    loadAccounts();
});

// account manager event listeners
ipcRenderer.on('accounts-updated', loadAccounts);

const accSelector = document.getElementById('accountSelector');
if (accSelector) {
    accSelector.addEventListener('change', (e) => {
        ipcRenderer.send('switch-account', e.target.value);
    });
}

const addBtn = document.getElementById('addAccountBtn');
if (addBtn) {
    addBtn.addEventListener('click', () => {
        ipcRenderer.send('add-account');
    });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        ipcRenderer.send('logout-account');
    });
}

// standard UI event listeners
document.getElementById('customThemeSelector')?.addEventListener('change', async (e) => {
    const themeName = e.target.value;
    try {
        await ipcRenderer.invoke('apply-custom-theme', themeName);
        ipcRenderer.send('setting-changed', { key: 'customTheme', value: themeName });
    } catch (error) {
        console.error('Failed to apply custom theme:', error);
    }
});

document.getElementById('openThemesFolder')?.addEventListener('click', async () => {
    try {
        const themesPath = await ipcRenderer.invoke('get-themes-folder-path');
        shell.openPath(themesPath);
    } catch (error) {
        console.error('Failed to open themes folder:', error);
    }
});

document.getElementById('refreshThemes')?.addEventListener('click', async () => {
    try {
        await ipcRenderer.invoke('refresh-custom-themes');
        await loadCustomThemes();
    } catch (error) {
        console.error('Failed to refresh themes:', error);
    }
});

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

document.getElementById('openPluginsFolder')?.addEventListener('click', async () => {
    try {
        const pluginsPath = await ipcRenderer.invoke('get-plugins-folder-path');
        shell.openPath(pluginsPath);
    } catch (error) {
        console.error('Failed to open plugins folder:', error);
    }
});

document.getElementById('refreshPlugins')?.addEventListener('click', async () => {
    try {
        await ipcRenderer.invoke('refresh-plugins');
        await loadPlugins();
    } catch (error) {
        console.error('Failed to refresh plugins:', error);
    }
});

// UI customization toggles
document.getElementById('hidePromotions')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'hidePromotions', value: e.target.checked });
});

document.getElementById('hideEventsNearYou')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'hideEventsNearYou', value: e.target.checked });
});

document.getElementById('hideArtistUpsells')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'hideArtistUpsells', value: e.target.checked });
});

document.getElementById('proxyEnabled')?.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    document.getElementById('proxyFields').style.display = isEnabled ? 'block' : 'none';
    ipcRenderer.send('setting-changed', { key: 'proxyEnabled', value: isEnabled });
});

document.getElementById('proxyHost')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'proxyHost', value: e.target.value });
});

document.getElementById('proxyPort')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'proxyPort', value: e.target.value });
});

document.getElementById('lastFmEnabled')?.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    document.getElementById('lastFmFields').style.display = isEnabled ? 'block' : 'none';
    ipcRenderer.send('setting-changed', { key: 'lastFmEnabled', value: isEnabled });
});

document.getElementById('lastFmApiKey')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'lastFmApiKey', value: e.target.value });
});

document.getElementById('lastFmSecret')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'lastFmSecret', value: e.target.value });
});

document.getElementById('createLastFmApiKey')?.addEventListener('click', (e) => {
    e.preventDefault();
    shell.openExternal('https://www.last.fm/api/account/create');
});

document.getElementById('webhookEnabled')?.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    document.getElementById('webhookFields').style.display = isEnabled ? 'block' : 'none';
    document.getElementById('webhookFields2').style.display = isEnabled ? 'block' : 'none';
    ipcRenderer.send('setting-changed', { key: 'webhookEnabled', value: isEnabled });
});

document.getElementById('webhookUrl')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'webhookUrl', value: e.target.value });
});

document.getElementById('webhookTriggerPercentage')?.addEventListener('input', (e) => {
    let value = parseInt(e.target.value);
    if (value < 0) value = 0;
    if (value > 100) value = 100;
    if (isNaN(value)) value = 50;

    e.target.value = value;
    ipcRenderer.send('setting-changed', { key: 'webhookTriggerPercentage', value: value });
});

document.getElementById('webhookExampleToggle')?.addEventListener('click', (e) => {
    const toggle = e.currentTarget;
    const content = document.getElementById('webhookExampleContent');
    const isExpanded = content.style.display === 'block';

    if (isExpanded) {
        content.style.display = 'none';
        toggle.classList.remove('expanded');
    } else {
        content.style.display = 'block';
        toggle.classList.add('expanded');
    }
});

document.getElementById('darkMode')?.addEventListener('change', (e) => {
    const isDark = e.target.checked;
    ipcRenderer.send('setting-changed', { key: 'theme', value: isDark ? 'dark' : 'light' });
    document.documentElement.classList.toggle('theme-light', !isDark);
    document.documentElement.classList.toggle('theme-dark', isDark);
});

document.getElementById('minimizeToTray')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'minimizeToTray', value: e.target.checked });
});

document.getElementById('navigationControlsEnabled')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'navigationControlsEnabled', value: e.target.checked });
});

document.getElementById('trackParserEnabled')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'trackParserEnabled', value: e.target.checked });
});

document.getElementById('autoUpdaterEnabled')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'autoUpdaterEnabled', value: e.target.checked });
});

document.getElementById('richPresencePreviewEnabled')?.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    const container = document.getElementById('presencePreviewContainer');
    if (container) {
        container.style.display = isEnabled ? 'block' : 'none';
    }
    ipcRenderer.send('setting-changed', { key: 'richPresencePreviewEnabled', value: isEnabled });
});

document.getElementById('displayWhenIdling')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'displayWhenIdling', value: e.target.checked });
});

document.getElementById('displaySCSmallIcon')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'displaySCSmallIcon', value: e.target.checked });
});

document.getElementById('adBlocker')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'adBlocker', value: e.target.checked });
});

document.getElementById('discordRichPresence')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'discordRichPresence', value: e.target.checked });
});

document.getElementById('displayButtons')?.addEventListener('change', (e) => {
    ipcRenderer.send('setting-changed', { key: 'displayButtons', value: e.target.checked });
});

document.getElementById('useArtistInStatusLineToggle')?.addEventListener('change', (e) => {
    const useState = e.target.checked;
    ipcRenderer.send('setting-changed', { key: 'statusDisplayType', value: useState ? 1 : 0 });
});

document.getElementById('applyChanges')?.addEventListener('click', () => {
    ipcRenderer.send('apply-changes');
});

// rich presence preview logic
let currentTrack = null;
let progressInterval = null;

function parseTimeToMs(time) {
    if (!time) return 0;
    const isNegative = time.trim().startsWith('-');
    const raw = isNegative ? time.trim().slice(1) : time.trim();
    const parts = raw.split(':').map(p => Number(p));
    let seconds = 0;
    for (const part of parts) {
        seconds = seconds * 60 + (isNaN(part) ? 0 : part);
    }
    const ms = seconds * 1000;
    return isNegative ? -ms : ms;
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function safeText(value, fallback) {
    return typeof value === 'string' && value.trim() ? value : fallback;
}

function safeRemoteUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:' ? parsed.href : '';
    } catch {
        return '';
    }
}

function createTextElement(className, text) {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    return el;
}

function createPlayingPreview(trackInfo, options) {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(createTextElement('activity-header-preview', 'Listening to SoundCloud'));

    const row = document.createElement('div');
    if (options.inlineRow) {
        row.style.display = 'flex';
        row.style.alignItems = 'flex-start';
        row.style.gap = '12px';
    } else {
        row.className = 'activity-row-preview';
    }

    const imageWrap = document.createElement('div');
    imageWrap.className = 'activity-image-preview';
    const artworkUrl = safeRemoteUrl(trackInfo.artwork).replace('50x50.', '300x300.');
    if (artworkUrl) {
        const img = document.createElement('img');
        img.src = artworkUrl;
        img.alt = 'Track artwork';
        img.addEventListener('error', () => {
            img.style.display = 'none';
        });
        imageWrap.appendChild(img);
    }

    if (options.displaySCSmallIcon) {
        const smallIcon = document.createElement('div');
        smallIcon.className = 'small-icon-preview';
        const icon = document.createElement('img');
        icon.src = 'https://cdn.discordapp.com/app-assets/1090770350251458592/1090771481627197580.png?size=160';
        icon.alt = 'SoundCloud';
        icon.style.width = '16px';
        icon.style.height = '16px';
        icon.style.borderRadius = '50%';
        smallIcon.appendChild(icon);
        imageWrap.appendChild(smallIcon);
    }

    const details = document.createElement('div');
    details.className = 'activity-details-preview';
    details.appendChild(createTextElement('activity-name-preview', safeText(trackInfo.title, 'Unknown Track')));
    details.appendChild(createTextElement('activity-details-text-preview', 'by ' + safeText(trackInfo.author, 'Unknown Artist')));

    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-bar-container-preview';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar-preview';
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-bar-fill-preview';
    progressFill.id = 'progressFillPreview';
    progressBar.appendChild(progressFill);
    progressContainer.appendChild(progressBar);

    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'time-display-preview';
    const currentTime = document.createElement('span');
    currentTime.id = 'currentTimePreview';
    currentTime.textContent = safeText(trackInfo.elapsed, '0:00');
    const totalTime = document.createElement('span');
    totalTime.id = 'totalTimePreview';
    totalTime.textContent = safeText(trackInfo.duration, '0:00');
    timeDisplay.appendChild(currentTime);
    timeDisplay.appendChild(totalTime);
    progressContainer.appendChild(timeDisplay);
    details.appendChild(progressContainer);

    const trackUrl = safeRemoteUrl(trackInfo.url);
    if (options.displayButtons && trackUrl) {
        const buttons = document.createElement('div');
        buttons.className = 'activity-buttons-preview';
        const button = document.createElement('button');
        button.className = 'activity-button-preview';
        button.textContent = 'Listen on SoundCloud';
        button.addEventListener('click', () => shell.openExternal(trackUrl));
        buttons.appendChild(button);
        details.appendChild(buttons);
    }

    row.appendChild(imageWrap);
    row.appendChild(details);
    fragment.appendChild(row);
    return fragment;
}

function createPausedPreview(options) {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(createTextElement('activity-header-preview', 'Using SoundCloud'));

    const row = document.createElement('div');
    if (options.inlineRow) {
        row.style.display = 'flex';
        row.style.alignItems = 'flex-start';
        row.style.gap = '12px';
    } else {
        row.className = 'activity-row-preview';
    }

    const imageWrap = document.createElement('div');
    imageWrap.className = 'activity-image-preview';
    const details = document.createElement('div');
    details.className = 'activity-details-preview';
    details.appendChild(createTextElement('activity-details-text-preview', 'Paused'));
    row.appendChild(imageWrap);
    row.appendChild(details);
    fragment.appendChild(row);
    return fragment;
}

function updatePreview(trackInfo) {
    currentTrack = trackInfo;
    const activitySection = document.getElementById('activitySectionPreview');
    const noActivity = document.getElementById('noActivityPreview');

    const displayWhenIdling = document.getElementById('displayWhenIdling')?.checked || false;
    const displaySCSmallIcon = document.getElementById('displaySCSmallIcon')?.checked || false;
    const displayButtons = document.getElementById('displayButtons')?.checked || false;

    if (!trackInfo || (!trackInfo.isPlaying && !displayWhenIdling)) {
        if (noActivity) noActivity.style.display = 'block';
        const existingContent = activitySection?.querySelector('.activity-content-preview');
        if (existingContent) existingContent.remove();
        clearInterval(progressInterval);
        return;
    }

    if (noActivity) noActivity.style.display = 'none';

    const existingContent = activitySection?.querySelector('.activity-content-preview');
    if (existingContent) existingContent.remove();

    const activityContent = document.createElement('div');
    activityContent.className = 'activity-content-preview';

    if (trackInfo.isPlaying) {
        activityContent.appendChild(createPlayingPreview(trackInfo, {
            displaySCSmallIcon,
            displayButtons,
            inlineRow: true,
        }));
        startProgressUpdate(trackInfo);
    } else if (displayWhenIdling) {
        activityContent.appendChild(createPausedPreview({ inlineRow: false }));
    }

    if (activitySection) activitySection.appendChild(activityContent);
}

function startProgressUpdate(trackInfo) {
    clearInterval(progressInterval);

    if (!trackInfo.isPlaying || !trackInfo.elapsed || !trackInfo.duration) return;

    const startTime = Date.now();
    const elapsedMs = parseTimeToMs(trackInfo.elapsed);
    const totalMs = parseTimeToMs(trackInfo.duration);

    function updateProgress() {
        const now = Date.now();
        const currentElapsed = elapsedMs + (now - startTime);
        const progress = Math.min((currentElapsed / totalMs) * 100, 100);

        const progressFill = document.getElementById('progressFillPreview');
        const currentTimeEl = document.getElementById('currentTimePreview');

        if (progressFill) progressFill.style.width = `${progress}%`;
        if (currentTimeEl) currentTimeEl.textContent = formatTime(currentElapsed);

        if (progress >= 100) clearInterval(progressInterval);
    }

    updateProgress();
    progressInterval = setInterval(updateProgress, 1000);
}

// external event triggers
ipcRenderer.on('presence-preview-update', (_, trackInfo) => {
    updatePreview(trackInfo);
});

ipcRenderer.on('theme-changed', (_, isDark) => {
    const dm = document.getElementById('darkMode');
    if (dm) dm.checked = isDark;
    document.documentElement.classList.toggle('theme-light', !isDark);
});

ipcRenderer.on('update-translations', () => {
    ipcRenderer.invoke('get-translations').then((translations) => {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key && translations[key]) {
                if (element.tagName === 'H2' && element.querySelector('svg')) {
                    const svg = element.querySelector('svg');
                    element.textContent = translations[key];
                    if (svg) element.appendChild(svg);
                } else {
                    element.textContent = translations[key];
                }
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (key && translations[key]) {
                element.setAttribute('placeholder', translations[key]);
            }
        });

        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            if (key && translations[key]) {
                element.setAttribute('title', translations[key]);
            }
        });
    });
});

// animation handling
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.remove('visible');
});

// handle close button animation
document.getElementById('close-settings').addEventListener('click', (e) => {
    e.preventDefault();
    document.body.classList.remove('visible');
    setTimeout(() => {
        ipcRenderer.send('toggle-settings');
    }, 300);
});

// listen for messages
window.addEventListener('message', (event) => {
    if (event.data === 'hidePanel') {
        console.log('hidePanel');
    }
});
