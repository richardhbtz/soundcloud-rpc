const ipcRenderer = {
    send: (channel, ...args) => window.headerAPI.send(channel, ...args),
    invoke: (channel, ...args) => window.headerAPI.invoke(channel, ...args),
    on: (channel, listener) => window.headerAPI.on(channel, (...args) => listener(null, ...args)),
};
const platform = window.headerAPI.platform;

let isMaximized = false;
let canGoBack = false;
let canGoForward = false;
let isRefreshing = false;
let navButtons = null;
let themeColors = null;
let minimizeGlyphEl = null;
let maximizeGlyphEl = null;
let closeGlyphEl = null;

const SEGOE_GLYPHS = {
    minimize: '\uE921',
    maximize: '\uE922',
    restore: '\uE923',
    close: '\uE8BB',
    closeHighContrast: '\uEF2C',
};
const forcedColorsQuery = window.matchMedia ? window.matchMedia('(forced-colors: active)') : null;

function applyThemeColors(colors) {
    themeColors = colors;
    if (!colors) {
        // no custom theme: drop the overrides so the stylesheet's theme classes apply again
        document.documentElement.style.removeProperty('--header-bg');
        document.documentElement.style.removeProperty('--header-text');
        document.documentElement.style.removeProperty('--header-accent');
        resetHeaderColors();
        return;
    }

    document.documentElement.style.setProperty('--header-bg', colors.primary || colors.background);
    document.documentElement.style.setProperty('--header-text', colors.text);
    document.documentElement.style.setProperty('--header-accent', colors.accent || colors.primary);

    const header = document.querySelector('.custom-header');
    if (header) {
        header.style.backgroundColor = colors.surface || colors.background;
        header.style.color = colors.text;
    }
}

function resetHeaderColors() {
    const header = document.querySelector('.custom-header');
    header?.style.removeProperty('background-color');
    header?.style.removeProperty('color');
}

function setNavigationControlsVisible(visible) {
    const navControls = document.querySelector('.navigation-controls');
    navControls?.classList.toggle('visible', visible);
    navControls?.classList.toggle('hidden', !visible);
}

function updateNavigationState(state = {}) {
    if (!navButtons) {
        navButtons = {
            back: document.getElementById('back-btn'),
            forward: document.getElementById('forward-btn'),
            refresh: document.getElementById('refresh-btn'),
        };
    }

    if ('canGoBack' in state) canGoBack = state.canGoBack;
    if ('canGoForward' in state) canGoForward = state.canGoForward;

    if ('refreshing' in state) {
        isRefreshing = state.refreshing;
        if (navButtons.refresh) {
            navButtons.refresh.classList.toggle('refreshing', isRefreshing);
            navButtons.refresh.title = isRefreshing ? 'Cancel Refresh' : 'Refresh Page';
        }
    }

    if (navButtons.back) navButtons.back.classList.toggle('disabled', !canGoBack);
    if (navButtons.forward) navButtons.forward.classList.toggle('disabled', !canGoForward);
}

// only Windows draws its own caption buttons
function updateWindowControls() {
    if (platform === 'win32') {
        if (!maximizeGlyphEl) {
            maximizeGlyphEl = document.querySelector('#maximize-btn .icon-glyph');
        }
        if (!maximizeGlyphEl) return;

        setIconGlyph(maximizeGlyphEl, isMaximized ? SEGOE_GLYPHS.restore : SEGOE_GLYPHS.maximize);

        const label = isMaximized ? 'Restore' : 'Maximize';
        document.getElementById('maximize-btn').title = label;
        document.getElementById('maximize-btn').setAttribute('aria-label', label);
    }
}

function setIconGlyph(element, glyph) {
    if (!element) return;
    element.textContent = glyph;
}

function initializeIcons() {
    try {
        if (platform === 'win32') {
            minimizeGlyphEl = document.querySelector('#minimize-btn .icon-glyph');
            maximizeGlyphEl = document.querySelector('#maximize-btn .icon-glyph');
            closeGlyphEl = document.querySelector('#close-btn .icon-glyph');

            setIconGlyph(minimizeGlyphEl, SEGOE_GLYPHS.minimize);
            setIconGlyph(maximizeGlyphEl, SEGOE_GLYPHS.maximize);
            setIconGlyph(closeGlyphEl, getCloseGlyph());

            if (forcedColorsQuery?.addEventListener) {
                forcedColorsQuery.addEventListener('change', handleForcedColorsChange);
            } else if (forcedColorsQuery?.addListener) {
                forcedColorsQuery.addListener(handleForcedColorsChange);
            }
        }
    } catch (error) {
        console.error('Error initializing icons:', error);
    }
}

function getCloseGlyph() {
    return forcedColorsQuery?.matches ? SEGOE_GLYPHS.closeHighContrast : SEGOE_GLYPHS.close;
}

function handleForcedColorsChange() {
    if (closeGlyphEl) {
        setIconGlyph(closeGlyphEl, getCloseGlyph());
    }
}

document.body.classList.add(`platform-${platform}`);

document.querySelector('.navigation-controls')?.addEventListener('click', (e) => {
    const { id } = e.target.closest('.nav-button') || {};

    switch (id) {
        case 'back-btn':
            if (canGoBack) ipcRenderer.send('navigate-back');
            break;
        case 'forward-btn':
            if (canGoForward) ipcRenderer.send('navigate-forward');
            break;
        case 'refresh-btn':
            if (isRefreshing) {
                ipcRenderer.send('cancel-refresh');
                updateNavigationState({ refreshing: false });
            } else {
                ipcRenderer.send('refresh-page');
                updateNavigationState({ refreshing: true });
            }
            break;
    }
});

document.getElementById('minimize-btn')?.addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

document.getElementById('maximize-btn')?.addEventListener('click', () => {
    ipcRenderer.send('maximize-window');
    isMaximized = !isMaximized;
    updateWindowControls();
});

document.getElementById('close-btn')?.addEventListener('click', () => {
    ipcRenderer.send('close-window');
});

document.querySelectorAll('.title-bar').forEach((spacer) =>
    spacer.addEventListener('dblclick', () => {
        ipcRenderer.send('title-bar-double-click');
        isMaximized = !isMaximized;
        updateWindowControls();
    }),
);

// Tabs. The selected tab is also the URL bar: it shows the address without https://soundcloud.com/,
// and the full address only while it is being edited.
const tabGroup = document.getElementById('tab-group');
let tabState = { tabs: [], activeId: null, url: '', display: '', fallbackIcon: '' };
let renderedTabState = '';
// a state update that arrived mid-edit or mid-drag; rebuilding the tabs then would drop the input or the drag
let pendingTabState = null;

function renderTabs(state) {
    if (tabGroup.querySelector('.tab.editing, .tab.dragging')) {
        pendingTabState = state;
        return;
    }
    pendingTabState = null;

    const serialized = JSON.stringify(state);
    if (serialized === renderedTabState) return;
    renderedTabState = serialized;
    tabState = state;

    tabGroup.classList.toggle('single', state.tabs.length === 1);
    tabGroup.replaceChildren(...state.tabs.map(buildTab));
}

function buildTab(tab) {
    const active = tab.id === tabState.activeId;
    const el = document.createElement('div');
    el.className = active ? 'tab active' : 'tab';
    el.dataset.id = tab.id;
    el.draggable = true;
    el.title = tab.title;

    const icon = document.createElement('img');
    icon.className = 'tab-icon';
    icon.draggable = false;
    icon.onerror = () => {
        icon.onerror = null;
        icon.src = tabState.fallbackIcon;
    };
    icon.src = tab.icon || tabState.fallbackIcon;

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title;
    el.append(icon, title);

    if (active) {
        const path = document.createElement('span');
        path.className = 'tab-path';
        path.textContent = tabState.display;

        const input = document.createElement('input');
        input.className = 'tab-url';
        input.spellcheck = false;
        input.setAttribute('aria-label', 'Address');
        el.append(path, input);
    }

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.type = 'button';
    close.title = 'Close Tab';
    close.textContent = '\u00d7';
    el.append(close);

    return el;
}

function applyPendingTabState() {
    if (pendingTabState) renderTabs(pendingTabState);
}

function editUrl() {
    const tab = tabGroup.querySelector('.tab.active');
    const input = tab?.querySelector('.tab-url');
    if (!input || tab.classList.contains('editing')) return;

    tab.classList.add('editing');
    tab.draggable = false;
    input.value = tabState.url;
    input.focus();
    input.select();
}

const tabId = (el) => Number(el?.closest('.tab')?.dataset.id);

tabGroup.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;

    if (e.target.closest('.tab-close')) ipcRenderer.send('tab-close', tabId(tab));
    else if (tab.classList.contains('active')) editUrl();
    else ipcRenderer.send('tab-select', tabId(tab));
});

// middle click closes, as in a browser
tabGroup.addEventListener('auxclick', (e) => {
    if (e.button === 1 && e.target.closest('.tab') && tabState.tabs.length > 1) {
        ipcRenderer.send('tab-close', tabId(e.target));
    }
});

function stopEditingUrl() {
    const tab = tabGroup.querySelector('.tab.editing');
    if (!tab) return;
    tab.classList.remove('editing');
    tab.draggable = true;
    applyPendingTabState();
}

tabGroup.addEventListener('keydown', (e) => {
    if (!e.target.matches('.tab-url')) return;
    if (e.key === 'Enter') ipcRenderer.send('navigate-url', e.target.value);
    if (e.key === 'Enter' || e.key === 'Escape') {
        // not left to focusout alone: that event does not fire while the window is in the background
        stopEditingUrl();
        e.target.blur();
    }
});

tabGroup.addEventListener('focusout', (e) => {
    if (e.target.matches('.tab-url')) stopEditingUrl();
});

// drag a tab onto another to take its place
tabGroup.addEventListener('dragstart', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    tab.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.dataset.id);
});

tabGroup.addEventListener('dragover', (e) => {
    const target = e.target.closest('.tab');
    if (!target || !tabGroup.querySelector('.tab.dragging')) return;
    e.preventDefault();
    tabGroup.querySelector('.tab.drop-target')?.classList.remove('drop-target');
    if (!target.classList.contains('dragging')) target.classList.add('drop-target');
});

tabGroup.addEventListener('drop', (e) => {
    const dragged = tabGroup.querySelector('.tab.dragging');
    const target = e.target.closest('.tab');
    if (!dragged || !target || dragged === target) return;
    e.preventDefault();
    ipcRenderer.send('tab-move', tabId(dragged), [...tabGroup.children].indexOf(target));
});

tabGroup.addEventListener('dragend', () => {
    tabGroup
        .querySelectorAll('.dragging, .drop-target')
        .forEach((el) => el.classList.remove('dragging', 'drop-target'));
    applyPendingTabState();
});

document.getElementById('new-tab-btn')?.addEventListener('click', () => {
    ipcRenderer.send('tab-new');
});

// Downloads: opens the progress popup, and lights up while something is downloading
const downloadsBtn = document.getElementById('downloads-btn');
downloadsBtn?.addEventListener('click', () => ipcRenderer.send('toggle-downloads'));
ipcRenderer.on('download-button-toggle', (_, enabled) => downloadsBtn?.classList.toggle('hidden', !enabled));
ipcRenderer.on('downloads-active', (_, active) => downloadsBtn?.classList.toggle('active', active > 0));

document.getElementById('menu-btn')?.addEventListener('click', () => ipcRenderer.send('toggle-settings'));

ipcRenderer.on('tabs-changed', (_, state) => renderTabs(state));
ipcRenderer.on('focus-url-bar', () => editUrl());

ipcRenderer.on('theme-changed', (_, isDark) => {
    document.documentElement.classList.toggle('theme-light', !isDark);
    if (!themeColors) resetHeaderColors();
});

ipcRenderer.on('theme-colors-changed', (_, colors) => applyThemeColors(colors));

ipcRenderer.on('window-maximized-changed', (_, maximized) => {
    if (isMaximized === maximized) return;
    isMaximized = maximized;
    updateWindowControls();
});

ipcRenderer.on('navigation-state-changed', (_, state) => updateNavigationState(state));
ipcRenderer.on('refresh-state-changed', (_, refreshing) => updateNavigationState({ refreshing }));
ipcRenderer.on('navigation-controls-toggle', (_, enabled) => setNavigationControlsVisible(enabled));

document.addEventListener('DOMContentLoaded', () => {
    initializeIcons();
    updateNavigationState();

    ipcRenderer.invoke('get-navigation-controls-enabled').then((enabled) => {
        if (enabled) setNavigationControlsVisible(true);
    });

    ipcRenderer.invoke('get-download-button-enabled').then((enabled) => {
        downloadsBtn?.classList.toggle('hidden', !enabled);
    });

    // tabs opened before this page finished loading
    ipcRenderer.invoke('get-tab-state').then(renderTabs);

    ipcRenderer.invoke('get-theme-colors').then((colors) => {
        if (colors) applyThemeColors(colors);
    });

    // seed once; further changes arrive on 'window-maximized-changed'
    ipcRenderer.invoke('is-maximized').then((maximized) => {
        if (isMaximized !== maximized) {
            isMaximized = maximized;
            updateWindowControls();
        }
    });
});
