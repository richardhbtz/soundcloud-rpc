import { app, BrowserWindow, dialog, Menu, ipcMain } from 'electron';
import { ElectronBlocker, fullLists } from '@cliqz/adblocker-electron';
import { readFileSync, writeFileSync } from 'fs';
import { Client as DiscordClient } from '@xhayper/discord-rpc';
import fetch from 'cross-fetch';
import { setupDarwinMenu } from './macos/menu';
import { NotificationManager } from './notifications/notificationManager';
import { SettingsManager } from './settings/settingsManager';
import { ProxyService } from './services/proxyService';
import { PresenceService } from './services/presenceService';
import { LastFmService } from './services/lastFmService';

const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const windowStateManager = require('electron-window-state');
const localShortcuts = require('electron-localshortcut');

// Store configuration
const store = new Store({
    defaults: {
        adBlocker: false,
        proxyEnabled: false,
        proxyHost: '',
        proxyPort: '',
        proxyData: { user: '', password: '' },
        lastFmEnabled: false,
        lastFmApiKey: '',
        lastFmSecret: '',
        lastFmSessionKey: '',
        displayWhenIdling: false,
        displaySCSmallIcon: false,
        discordRichPresence: true
    },
    clearInvalidConfig: true,
    encryptionKey: 'soundcloud-rpc-config'
});

// Global variables
let mainWindow: BrowserWindow | null;
let notificationManager: NotificationManager;
let settingsManager: SettingsManager;
let proxyService: ProxyService;
let presenceService: PresenceService;
let lastFmService: LastFmService;

// Display settings
let displayWhenIdling = store.get('displayWhenIdling') as boolean;
let displaySCSmallIcon = store.get('displaySCSmallIcon') as boolean;

// Update handling
function setupUpdater() {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', () => {
        queueToastNotification('Update Available');
    });

    autoUpdater.on('update-downloaded', () => {
        queueToastNotification('Update Completed');
    });

    autoUpdater.checkForUpdates();
}

// Browser window configuration
function createBrowserWindow(windowState: any): BrowserWindow {
    const window = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            javascript: true,
            images: true,
            plugins: true,
            experimentalFeatures: false,
            devTools: false,
        },
        backgroundColor: '#ffffff',
    });

    // Set Chrome-like properties
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

    window.webContents.setUserAgent(userAgent);

    // Configure session
    const session = window.webContents.session;
    session.webRequest.onBeforeSendHeaders((details, callback) => {
        if (details.url.includes('google')) {
            callback({ requestHeaders: details.requestHeaders });
            return;
        }
        const headers = {
            ...details.requestHeaders,
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': userAgent,
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
        };
        callback({ requestHeaders: headers });
    });

    return window;
}

// Track info polling
async function pollTrackInfo() {
    if (!mainWindow) return;

    try {
        const html = await mainWindow.webContents.executeJavaScript(
            `document.documentElement.outerHTML`,
            true
        );

        const parser = new (require('jsdom')).JSDOM(html);
        const document = parser.window.document;

        const playButton = document.querySelector('.playControls__play');
        const isPlaying = playButton ? playButton.classList.contains('playing') : false;

        if (isPlaying) {
            const authorEl = document.querySelector('.playbackSoundBadge__lightLink');
            const artworkEl = document.querySelector('.playbackSoundBadge__avatar .image__lightOutline span');
            const elapsedEl = document.querySelector('.playbackTimeline__timePassed span:last-child');
            const durationEl = document.querySelector('.playbackTimeline__duration span:last-child');

            const trackInfo = {
                title: artworkEl?.getAttribute("aria-label") || '',
                author: authorEl?.textContent?.trim() || '',
                artwork: artworkEl ? artworkEl.style.backgroundImage.replace(/^url\(['"]?|['"]?\)$/g, '') : '',
                elapsed: elapsedEl?.textContent?.trim() || '',
                duration: durationEl?.textContent?.trim() || ''
            };

            if (!trackInfo.title || !trackInfo.author) {
                console.error('Incomplete track info:', trackInfo);
                return;
            }

            await lastFmService.updateTrackInfo({
                title: trackInfo.title,
                author: trackInfo.author,
                duration: trackInfo.duration
            });

            await presenceService.updatePresence({
                ...trackInfo,
                isPlaying: true
            });
        } else {
            await presenceService.updatePresence({
                title: '',
                author: '',
                artwork: '',
                elapsed: '',
                duration: '',
                isPlaying: false
            });
        }
    } catch (error) {
        console.error('Error during track info update:', error);
    }
}

// Main initialization
async function init() {
    setupUpdater();

    if (process.platform === 'darwin') setupDarwinMenu();
    else Menu.setApplicationMenu(null);

    const windowState = windowStateManager({ defaultWidth: 800, defaultHeight: 800 });
    mainWindow = createBrowserWindow(windowState);

    // Initialize services
    notificationManager = new NotificationManager(mainWindow);
    settingsManager = new SettingsManager(mainWindow, store);
    proxyService = new ProxyService(mainWindow, store, queueToastNotification);
    presenceService = new PresenceService(mainWindow, store);
    lastFmService = new LastFmService(mainWindow, store);

    windowState.manage(mainWindow);

    // Apply initial settings
    await proxyService.apply();
    mainWindow.loadURL('https://soundcloud.com/discover');

    // Setup event handlers
    mainWindow.webContents.on('did-finish-load', async () => {
        await lastFmService.authenticate();

        if (store.get('adBlocker')) {
            const blocker = await ElectronBlocker.fromLists(
                fetch,
                fullLists,
                { enableCompression: true },
                {
                    path: 'engine.bin',
                    read: async (...args) => readFileSync(...args),
                    write: async (...args) => writeFileSync(...args),
                },
            );
            blocker.enableBlockingInSession(mainWindow.webContents.session);
        }

        // Start polling for track info
        setInterval(pollTrackInfo, 5000);
    });

    // Register settings related events
    ipcMain.on('setting-changed', async (_event, data) => {
        const key = proxyService.transformKey(data.key);
        store.set(key, data.value);

        if (key === 'displayWhenIdling') {
            displayWhenIdling = data.value;
            presenceService.updateDisplaySettings(displayWhenIdling, displaySCSmallIcon);
        } else if (key === 'displaySCSmallIcon') {
            displaySCSmallIcon = data.value;
            presenceService.updateDisplaySettings(displayWhenIdling, displaySCSmallIcon);
        }
    });

    // Handle applying all changes
    ipcMain.on('apply-changes', async () => {
        if (store.get('proxyEnabled')) {
            await proxyService.apply();
        }

        if (store.get('lastFmEnabled')) {
            await lastFmService.authenticate();
        }

        if (store.get('adBlocker')) {
            mainWindow.webContents.reload();
        }

        if (store.get('discordRichPresence')) {
            await presenceService.reconnect();
        } else {
            presenceService.clearActivity();
        }
    });

    // Register keyboard shortcuts
    localShortcuts.register(mainWindow, 'F1', () => {
        settingsManager.toggle();
    });

    let zoomLevel = mainWindow.webContents.getZoomLevel();

    localShortcuts.register(mainWindow, 'CmdOrCtrl+=', () => {
        zoomLevel = Math.min(zoomLevel + 1, 9);
        mainWindow.webContents.setZoomLevel(zoomLevel);
    });

    localShortcuts.register(mainWindow, 'CmdOrCtrl+-', () => {
        zoomLevel = Math.max(zoomLevel - 1, -9);
        mainWindow.webContents.setZoomLevel(zoomLevel);
    });

    localShortcuts.register(mainWindow, 'CmdOrCtrl+0', () => {
        zoomLevel = 0;
        mainWindow.webContents.setZoomLevel(zoomLevel);
    });

    localShortcuts.register(mainWindow, ['CmdOrCtrl+B', 'CmdOrCtrl+P'], () => mainWindow.webContents.navigationHistory.goBack());
    localShortcuts.register(mainWindow, ['CmdOrCtrl+F', 'CmdOrCtrl+N'], () => mainWindow.webContents.navigationHistory.goForward());
}

// App lifecycle handlers
app.on('ready', init);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        init();
    }
});

export function queueToastNotification(message: string) {
    if (mainWindow && notificationManager) {
        notificationManager.show(message);
    }
}
