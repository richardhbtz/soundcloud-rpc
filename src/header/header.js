/* eslint-disable */
const { ipcRenderer } = require('electron');

let isMaximized = false;
let isDarkTheme = true;
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
        // Reset to default - remove custom properties so CSS theme classes take effect
        document.documentElement.style.removeProperty('--header-bg');
        document.documentElement.style.removeProperty('--header-text');
        document.documentElement.style.removeProperty('--header-accent');

        // Also reset inline styles so CSS variables work
        const header = document.querySelector('.custom-header');
        if (header) {
            header.style.removeProperty('background-color');
            header.style.removeProperty('color');
        }
        return;
    }

    // Apply custom theme colors
    document.documentElement.style.setProperty('--header-bg', colors.primary || colors.background);
    document.documentElement.style.setProperty('--header-text', colors.text);
    document.documentElement.style.setProperty('--header-accent', colors.accent || colors.primary);

    // Update the header background
    const header = document.querySelector('.custom-header');
    if (header) {
        header.style.backgroundColor = colors.surface || colors.background;
        header.style.color = colors.text;
    }
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

// Helper function to update window controls
function updateWindowControls() {
    if (process.platform === 'win32') {
        if (!maximizeGlyphEl) {
            maximizeGlyphEl = document.querySelector('#maximize-btn .icon-glyph');
        }
        if (!maximizeGlyphEl) return;

        setIconGlyph(maximizeGlyphEl, isMaximized ? SEGOE_GLYPHS.restore : SEGOE_GLYPHS.maximize);

        // Update the button title
        document.getElementById('maximize-btn').title = isMaximized ? 'Restore' : 'Maximize';
        document.getElementById('maximize-btn').setAttribute('aria-label', isMaximized ? 'Restore' : 'Maximize');
    }
}

function setIconGlyph(element, glyph) {
    if (!element) return;
    element.textContent = glyph;
}

// Initialize icons
function initializeIcons() {
    try {
        // Only initialize SVG icons if we're on Windows
        if (process.platform === 'win32') {
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

// Set platform class on body
document.body.classList.add(`platform-${process.platform}`);

// Navigation event delegation
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

// Window control event listeners for Windows
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

// Double click on title bar to maximize/restore
document.querySelector('.title-bar')?.addEventListener('dblclick', () => {
    ipcRenderer.send('title-bar-double-click');
    isMaximized = !isMaximized;
    updateWindowControls();
});

// Listen for theme changes
ipcRenderer.on('theme-changed', (_, isDark) => {
    isDarkTheme = isDark;
    if (isDark) {
        document.documentElement.classList.remove('theme-light');
    } else {
        document.documentElement.classList.add('theme-light');
    }

    // If no custom theme colors are applied, reset inline styles to use CSS variables
    if (!themeColors) {
        const header = document.querySelector('.custom-header');
        if (header) {
            header.style.removeProperty('background-color');
            header.style.removeProperty('color');
        }
    }
});

// Listen for theme color updates
ipcRenderer.on('theme-colors-changed', (_, colors) => {
    applyThemeColors(colors);
});

// Listen for navigation state changes
ipcRenderer.on('navigation-state-changed', (_, state) => {
    updateNavigationState(state);
});

// Listen for refresh state changes
ipcRenderer.on('refresh-state-changed', (_, refreshing) => {
    updateNavigationState({ refreshing });
});

// Listen for navigation controls toggle
ipcRenderer.on('navigation-controls-toggle', (_, enabled) => {
    const navControls = document.querySelector('.navigation-controls');
    if (navControls) {
        if (enabled) {
            navControls.classList.add('visible');
            navControls.classList.remove('hidden');
        } else {
            navControls.classList.remove('visible');
            navControls.classList.add('hidden');
            navButtons = null;
        }
    }
});

// Initialize icons and navigation state when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeIcons();
    updateNavigationState();

    // Request initial navigation controls state
    ipcRenderer.invoke('get-navigation-controls-enabled').then((enabled) => {
        const navControls = document.querySelector('.navigation-controls');
        if (navControls && enabled) {
            navControls.classList.add('visible');
            navControls.classList.remove('hidden');
        }
    });

    // Request initial theme colors
    ipcRenderer.invoke('get-theme-colors').then((colors) => {
        if (colors) {
            applyThemeColors(colors);
        }
    });

    // Check window state periodically
    setInterval(() => {
        ipcRenderer.invoke('is-maximized').then((maximized) => {
            if (isMaximized !== maximized) {
                isMaximized = maximized;
                updateWindowControls();
            }
        });
    }, 100);
});
