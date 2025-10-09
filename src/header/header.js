/* eslint-disable */
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

let isMaximized = false;
let isDarkTheme = true;
let canGoBack = false;
let canGoForward = false;
let isRefreshing = false;
let navButtons = null;

function updateNavigationState(state = {}) {
    if (!navButtons) {
        navButtons = {
            back: document.getElementById('back-btn'),
            forward: document.getElementById('forward-btn'),
            refresh: document.getElementById('refresh-btn')
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
    console.log('updateWindowControls', isMaximized);
    if (process.platform === 'win32') {
        const maximizeBtn = document.querySelector('#maximize-btn svg');
        if (!maximizeBtn) return;

        // Load and set the appropriate icon
        const iconName = isMaximized ? 'restore.svg' : 'maximize.svg';
        setSvgContent(maximizeBtn, loadSvgContent(iconName));
        
        // Update the button title
        document.getElementById('maximize-btn').title = isMaximized ? 'Restore' : 'Maximize';
    }
}

// Helper function to load SVG file
function loadSvgContent(filename) {
    try {
        const filePath = path.join(__dirname, 'icons', filename);
        const content = fs.readFileSync(filePath, 'utf8');
        return content;
    } catch (error) {
        console.error(`Error loading SVG file ${filename}:`, error);
        return '';
    }
}

// Helper function to set SVG content
function setSvgContent(element, svgContent) {
    if (!element) {
        console.error('SVG element not found');
        return;
    }
    try {
        element.outerHTML = svgContent;
    } catch (error) {
        console.error('Error setting SVG content:', error);
    }
}

// Initialize icons
function initializeIcons() {
    try {
        // Only initialize SVG icons if we're on Windows
        if (process.platform === 'win32') {
            // Minimize icon
            const minimizeBtn = document.querySelector('#minimize-btn svg');
            setSvgContent(minimizeBtn, loadSvgContent('minimize.svg'));

            // Initial maximize/restore icon
            const maximizeBtn = document.querySelector('#maximize-btn svg');
            setSvgContent(maximizeBtn, loadSvgContent('maximize.svg'));

            // Close icon
            const closeBtn = document.querySelector('#close-btn svg');
            setSvgContent(closeBtn, loadSvgContent('close.svg'));
        }
    } catch (error) {
        console.error('Error initializing icons:', error);
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
