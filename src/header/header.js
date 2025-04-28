/* eslint-disable */
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

let isMaximized = false;
let isDarkTheme = true;

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
        // Minimize icon
        const minimizeBtn = document.querySelector('#minimize-btn svg');
        setSvgContent(minimizeBtn, loadSvgContent('minimize.svg'));

        // Maximize/Restore icons
        const maximizeIcon = document.getElementById('maximize-icon');
        const restoreIcon = document.getElementById('restore-icon');
        setSvgContent(maximizeIcon, loadSvgContent('maximize.svg'));
        setSvgContent(restoreIcon, loadSvgContent('restore.svg'));

        // Close icon
        const closeBtn = document.querySelector('#close-btn svg');
        setSvgContent(closeBtn, loadSvgContent('close.svg'));
    } catch (error) {
        console.error('Error initializing icons:', error);
    }
}

// Window control event listeners
document.getElementById('minimize-btn').addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

document.getElementById('maximize-btn').addEventListener('click', () => {
    ipcRenderer.send('maximize-window');
});

document.getElementById('close-btn').addEventListener('click', () => {
    ipcRenderer.send('close-window');
});

// Double click on title bar to maximize/restore
document.querySelector('.title-bar').addEventListener('dblclick', () => {
    ipcRenderer.send('title-bar-double-click');
});

// Listen for window state changes
ipcRenderer.on('window-state-changed', (_, state) => {
    isMaximized = state === 'maximized';
    document.getElementById('maximize-icon').style.display = isMaximized ? 'none' : 'inline-flex';
    document.getElementById('restore-icon').style.display = isMaximized ? 'inline-flex' : 'none';
    document.getElementById('maximize-btn').title = isMaximized ? 'Restore' : 'Maximize';
});

// Listen for theme changes
ipcRenderer.on('theme-changed', (_, isDark) => {
    isDarkTheme = isDark;
    if (isDark) {
        document.documentElement.classList.remove('theme-light');
    } else {
        document.documentElement.classList.add('theme-light');
        console.log('theme-light');
    }
});

// Initialize icons when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeIcons();
    ipcRenderer.send('get-initial-state');
});
