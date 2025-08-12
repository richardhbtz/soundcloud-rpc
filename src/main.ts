import { app, BrowserWindow, Menu, ipcMain, BrowserView, WebContents, Tray, nativeImage } from 'electron';
import { ElectronBlocker, fullLists } from '@ghostery/adblocker-electron';
import { readFileSync, writeFileSync } from 'fs';
import fetch from 'cross-fetch';
import { setupDarwinMenu } from './macos/menu';
import { NotificationManager } from './notifications/notificationManager';
import { SettingsManager } from './settings/settingsManager';
import { ProxyService } from './services/proxyService';
import { PresenceService } from './services/presenceService';
import { LastFmService } from './services/lastFmService';
import { TranslationService } from './services/translationService';
import { ThumbarService } from './services/thumbarService';
import { WebhookService } from './services/webhookService';
import { audioMonitorScript } from './services/audioMonitorService';
import path = require('path');
import { platform } from 'os';

const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const windowStateManager = require('electron-window-state');

export const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../assets');
console.log(`Resources path: ${RESOURCES_PATH}`);

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
        webhookEnabled: false,
        webhookUrl: '',
        webhookTriggerPercentage: 50,
        displayWhenIdling: false,
        displaySCSmallIcon: false,
        discordRichPresence: true,
        displayButtons: false,
        statusDisplayType: 1,
        theme: 'dark',
        minimizeToTray: false,
    },
    clearInvalidConfig: true,
    encryptionKey: 'soundcloud-rpc-config',
});

let isDarkTheme = store.get('theme') !== 'light';

// Global variables
let mainWindow: BrowserWindow;
let notificationManager: NotificationManager;
let settingsManager: SettingsManager;
let proxyService: ProxyService;
let presenceService: PresenceService;
let lastFmService: LastFmService;
let webhookService: WebhookService;
let translationService: TranslationService;
let thumbarService: ThumbarService;
let tray: Tray | null = null;
let isQuitting = false;
const devMode = process.argv.includes('--dev')

// Add missing property to app
declare global {
    namespace NodeJS {
        interface Global {
            app: any;
        }
    }
}

// Extend app with custom property
Object.defineProperty(app, 'isQuitting', {
    value: false,
    writable: true,
    configurable: true
});

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

// Tray setup
function setupTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }

    // Create tray icon
    const iconPath = path.join(RESOURCES_PATH, 'icons', process.platform === 'win32' ? 'soundcloud-win.ico' : 'soundcloud.png');
    const icon = nativeImage.createFromPath(iconPath);
    
    // Resize icon for tray (16x16 is standard for most systems)
    const trayIcon = icon.resize({ width: 16, height: 16 });
    
    tray = new Tray(trayIcon);
    tray.setToolTip('SoundCloud RPC');

    // Create tray menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'SoundCloud',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Settings',
            click: () => {
                if (settingsManager) {
                    settingsManager.toggle();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    // Handle tray icon click (show window)
    tray.on('click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // Handle tray icon double-click (show window)
    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// Update the language when retrieved from the web page
async function getLanguage() {
    if (!contentView) return;
    const langInfo = await contentView.webContents.executeJavaScript(`
        const langEl = document.querySelector('html');
        new Promise(resolve => {
            resolve({
                lang: langEl ? langEl.getAttribute('lang') : 'en',
            });
        })
    `);

    translationService.setLanguage(langInfo.lang);
}

// Browser window configuration
function createBrowserWindow(windowState: any): BrowserWindow {
    const window = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        frame: process.platform === 'darwin',
        titleBarStyle: process.platform === 'darwin' ? 'hidden' : undefined,
        trafficLightPosition: process.platform === 'darwin' ? { x: 10, y: 10 } : undefined,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            javascript: true,
            images: true,
            plugins: true,
            experimentalFeatures: false,
            devTools: devMode
        },
        backgroundColor: isDarkTheme ? '#121212' : '#ffffff',
    });

    const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

    window.webContents.setUserAgent(userAgent);

    const session = window.webContents.session;
    session.webRequest.onBeforeSendHeaders((details, callback) => {
        if (details.url.includes('google') || details.url.includes('icloud') || details.url.includes('apple')) {
            callback({ requestHeaders: details.requestHeaders });
            return;
        }

        const headers = {
            ...details.requestHeaders,
            'Accept-Language': 'en-US,en;q=0.9',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
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
let lastTrackInfo = {
    title: '',
    author: '',
    artwork: '',
    elapsed: '',
    duration: '',
    isPlaying: false,
    url: ''
};


function setupWindowControls() {
    if (!mainWindow) return;

    const HEADER_HEIGHT = 32;

    ipcMain.on('minimize-window', () => {
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.on('maximize-window', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    function adjustContentViews() {
        if (!mainWindow || !contentView || !headerView) return;

        const { width, height } = mainWindow.getContentBounds();

        headerView.setBounds({
            x: 0,
            y: 0,
            width,
            height: HEADER_HEIGHT,
        });

        contentView.setBounds({
            x: 0,
            y: HEADER_HEIGHT,
            width,
            height: height - HEADER_HEIGHT,
        });
    }

    ipcMain.on('title-bar-double-click', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    mainWindow.on('maximize', () => {
        adjustContentViews();
    });

    mainWindow.on('unmaximize', () => {
        adjustContentViews();
    });

    mainWindow.on('resize', () => {
        adjustContentViews();
    });

    ipcMain.on('close-window', () => {
        if (mainWindow) {
            const minimizeToTray = store.get('minimizeToTray', true);
            if (minimizeToTray) {
                mainWindow.hide();
            } else {
                mainWindow.close();
            }
        }
    });

    ipcMain.on('toggle-theme', () => {
        isDarkTheme = !isDarkTheme;
        if (headerView) {
            headerView.webContents.send('theme-changed', isDarkTheme);
        }
        applyThemeToContent(isDarkTheme);
    });

    // Handle is-maximized requests
    ipcMain.handle('is-maximized', () => {
        return mainWindow ? mainWindow.isMaximized() : false;
    });

    // Handle minimize to tray setting
    ipcMain.handle('get-minimize-to-tray', () => {
        return store.get('minimizeToTray', true);
    });

    adjustContentViews();
}

let headerView: BrowserView | null;
let contentView: BrowserView;

// Main initialization
async function init() {
    setupUpdater();
    setupTray(); // Call setupTray here

    if (process.platform === 'darwin') setupDarwinMenu();
    else Menu.setApplicationMenu(null);

    const windowState = windowStateManager({ defaultWidth: 800, defaultHeight: 800 });
    mainWindow = createBrowserWindow(windowState);

    windowState.manage(mainWindow);

    // Handle window close event for minimize to tray
    mainWindow.on('close', (event) => {
        const minimizeToTray = store.get('minimizeToTray', true);
        if (minimizeToTray && !isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // Handle window minimize event
    mainWindow.on('minimize', () => {
        const minimizeToTray = store.get('minimizeToTray', true);
        if (minimizeToTray) {
            mainWindow.hide();
        }
    });

    headerView = new BrowserView({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.addBrowserView(headerView);
    headerView.setBounds({ x: 0, y: 0, width: mainWindow.getBounds().width, height: 32 });
    headerView.setAutoResize({ width: true, height: false });
    headerView.webContents.loadFile(path.join(__dirname, 'header', 'header.html'));

    contentView = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            devTools: devMode,
            preload: path.join(__dirname, 'preload.js')
        },
    });

    mainWindow.addBrowserView(contentView);
    contentView.setBounds({
        x: 0,
        y: 32,
        width: mainWindow.getBounds().width,
        height: mainWindow.getBounds().height - 32,
    });
    contentView.setAutoResize({ width: true, height: true });

    contentView.webContents.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Initialize services
    translationService = new TranslationService();
    notificationManager = new NotificationManager(mainWindow);
    settingsManager = new SettingsManager(mainWindow, store, translationService);
    proxyService = new ProxyService(mainWindow, store, queueToastNotification);
    presenceService = new PresenceService(store, translationService);
    lastFmService = new LastFmService(contentView, store);
    webhookService = new WebhookService(store);
    if (platform() === 'win32')
        thumbarService = new ThumbarService(translationService);

    // Add settings toggle handler
    ipcMain.on('toggle-settings', () => {
        settingsManager.toggle();
    });

    setupWindowControls();

    setupShortcuts(contentView.webContents);
    setupShortcuts(mainWindow.webContents);
    setupShortcuts(settingsManager.getView().webContents);

    setupThemeHandlers();
    setupTranslationHandlers();
    setupAudioHandler();

    // Configure session
    const session = contentView.webContents.session;
    const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    session.webRequest.onBeforeSendHeaders((details, callback) => {
        if (details.url.includes('google')) {
            callback({ requestHeaders: details.requestHeaders });
            return;
        }
        const headers = {
            ...details.requestHeaders,
            'Accept-Language': 'en-US,en;q=0.9',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
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

    // Apply initial settings
    await proxyService.apply();
    contentView.webContents.loadURL('https://soundcloud.com/discover');

    // Setup event handlers
    contentView.webContents.on('did-finish-load', async () => {
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
                }
            );
            blocker.enableBlockingInSession(contentView.webContents.session);
        }

        notificationManager.show("Press 'F1' to open settings");

        // Get the current language from the page
        await getLanguage();

        // Update the language in the settings manager
        settingsManager.updateTranslations(translationService);

    });

    // Register settings related events
    ipcMain.on('setting-changed', async (_event, data) => {
        const key = proxyService.transformKey(data.key);
        store.set(key, data.value);

        console.log(key);

        if (key === 'displayWhenIdling') {
            displayWhenIdling = data.value;
            presenceService.updateDisplaySettings(displayWhenIdling, displaySCSmallIcon);
        } else if (key === 'displaySCSmallIcon') {
            displaySCSmallIcon = data.value;
            presenceService.updateDisplaySettings(displayWhenIdling, displaySCSmallIcon);
        } else if (key === 'displayButtons') {
            presenceService.updateDisplaySettings(displayWhenIdling, displaySCSmallIcon, data.value);
        } else if (key === 'statusDisplayType') {
            presenceService.setStatusDisplayType(data.value as number);
        } else if (key === 'minimizeToTray') {
            // Update tray behavior when setting changes
            if (data.value === false && tray) {
                // If minimize to tray is disabled, destroy the tray
                tray.destroy();
                tray = null;
            } else if (data.value === true && !tray) {
                // If minimize to tray is enabled, create the tray
                setupTray();
            }
        } else if (key === 'webhookEnabled') {
            webhookService.setEnabled(data.value);
        } else if (key === 'webhookUrl') {
            webhookService.setWebhookUrl(data.value);
        } else if (key === 'webhookTriggerPercentage') {
            webhookService.setTriggerPercentage(data.value);
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
            // Refresh presence using the current track info instead of reconnecting
            await presenceService.updatePresence(lastTrackInfo as any);
        } else {
            presenceService.clearActivity();
        }
    });
}

function setupThemeHandlers() {
    // Load initial theme from store
    isDarkTheme = store.get('theme', 'dark') === 'dark';

    // Send initial theme to all views
    if (headerView) {
        headerView.webContents.send('theme-changed', isDarkTheme);
    }
    if (settingsManager) {
        settingsManager.getView().webContents.send('theme-changed', isDarkTheme);
    }
    applyThemeToContent(isDarkTheme);

    // Listen for theme changes from settings or header
    ipcMain.on('setting-changed', (_, data) => {
        if (data.key === 'theme') {
            isDarkTheme = data.value === 'dark';
            store.set('theme', data.value);

            // Update all views
            if (headerView) {
                headerView.webContents.send('theme-changed', isDarkTheme);
            }
            if (settingsManager) {
                settingsManager.getView().webContents.send('theme-changed', isDarkTheme);
            }
            applyThemeToContent(isDarkTheme);
        }
    });
}

function applyThemeToContent(isDark: boolean) {
    if (!contentView) return;

    const themeScript = `
        (function() {
            try {
                document.documentElement.classList.toggle('theme-light', !${isDark});
                document.documentElement.classList.toggle('theme-dark', ${isDark});
                document.body.classList.toggle('theme-light', !${isDark});
                document.body.classList.toggle('theme-dark', ${isDark});
                
                if (${isDark}) {
                    document.documentElement.style.setProperty('--background-base', '#121212');
                    document.documentElement.style.setProperty('--background-surface', '#212121');
                    document.documentElement.style.setProperty('--text-base', '#ffffff');
                } else {
                    document.documentElement.style.setProperty('--background-base', '#ffffff');
                    document.documentElement.style.setProperty('--background-surface', '#f2f2f2');
                    document.documentElement.style.setProperty('--text-base', '#333333');
                }
                
                const style = document.createElement('style');
                style.id = 'custom-scrollbar-style';
                style.textContent = \`
                    ::-webkit-scrollbar-button {
                        display: none;
                    }
                    
                    ::-webkit-scrollbar {
                        width: 8px;
                        height: 8px;
                        background-color: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'};
                    }
                    
                    ::-webkit-scrollbar-track {
                        background-color: transparent;
                    }
                    
                    ::-webkit-scrollbar-thumb {
                        background-color: ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
                        border-radius: 4px;
                        transition: background-color 0.3s;
                    }
                    
                    ::-webkit-scrollbar-thumb:hover {
                        background-color: ${isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};
                    }
                    
                    ::-webkit-scrollbar-corner {
                        background-color: transparent;
                    }
                \`;
                
                const existingStyle = document.getElementById('custom-scrollbar-style');
                if (existingStyle) {
                    existingStyle.remove();
                }
                document.head.appendChild(style);
            } catch(e) {
                console.error('Error applying theme:', e);
            }
        })();
    `;

    contentView.webContents.executeJavaScript(themeScript).catch(console.error);
}

function setupShortcuts(contents: WebContents) {
    if (!mainWindow || !contentView) return;

    contents.on('before-input-event', (event, input) => {
        if (input.key === 'F1' && !input.alt && !input.control && !input.meta && !input.shift) {
            settingsManager.toggle();
            event.preventDefault();
        }

        if (input.key === '=' && input.control && !input.alt && !input.meta && !input.shift) {
            const zoomLevel = contents.getZoomLevel();
            contents.setZoomLevel(Math.min(zoomLevel + 1, 9));
            event.preventDefault();
        }
        if (input.key == "F12" && !input.alt && !input.control && !input.meta && !input.shift && devMode)  {
            contents.openDevTools();
            event.preventDefault();
        }

        if (input.key === '-' && input.control && !input.alt && !input.meta && !input.shift) {
            const zoomLevel = contents.getZoomLevel();
            contents.setZoomLevel(Math.max(zoomLevel - 1, -9));
            event.preventDefault();
        }

        if (input.key === '0' && input.control && !input.alt && !input.meta && !input.shift) {
            contents.setZoomLevel(0);
            event.preventDefault();
        }

        if ((input.key === 'b' || input.key === 'p') && input.control && !input.alt && !input.meta && !input.shift) {
            if (contents.canGoBack()) {
                contents.goBack();
            }
            event.preventDefault();
        }

        if ((input.key === 'f' || input.key === 'n') && input.control && !input.alt && !input.meta && !input.shift) {
            if (contents.canGoForward()) {
                contents.goForward();
            }
            event.preventDefault();
        }
    });

    mainWindow.webContents.on('before-input-event', (_, input) => {
        if (contents) {
            contents.sendInputEvent({
                type: input.type === 'keyDown' ? 'keyDown' : 'keyUp',
                keyCode: input.key,
                modifiers: [],
            });
        }
    });
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

app.on('before-quit', () => {
    isQuitting = true;
    if (tray) {
        tray.destroy();
        tray = null;
    }
});

app.on('will-quit', () => {
    if (tray) {
        tray.destroy();
        tray = null;
    }
});

export function queueToastNotification(message: string) {
    if (mainWindow && notificationManager) {
        notificationManager.show(message);
    }
}

function setupTranslationHandlers() {
    ipcMain.handle('get-translations', () => {
        return {
            client: translationService.translate('client'),
            darkMode: translationService.translate('darkMode'),
            adBlocker: translationService.translate('adBlocker'),
            enableAdBlocker: translationService.translate('enableAdBlocker'),
            changesAppRestart: translationService.translate('changesAppRestart'),
            proxy: translationService.translate('proxy'),
            proxyHost: translationService.translate('proxyHost'),
            proxyPort: translationService.translate('proxyPort'),
            enableProxy: translationService.translate('enableProxy'),
            enableLastFm: translationService.translate('enableLastFm'),
            lastFmApiKey: translationService.translate('lastFmApiKey'),
            lastFmSecret: translationService.translate('lastFmApiSecret'),
            createApiKeyLastFm: translationService.translate('createApiKeyLastFm'),
            noCallbackUrl: translationService.translate('noCallbackUrl'),
            enableRichPresence: translationService.translate('enableRichPresence'),
            displayWhenPaused: translationService.translate('displayWhenPaused'),
            displaySmallIcon: translationService.translate('displaySmallIcon'),
            displayButtons: translationService.translate('displayButtons'),
            useArtistInStatusLine: translationService.translate('useArtistInStatusLine'),
            applyChanges: translationService.translate('applyChanges'),
            minimizeToTray: translationService.translate('minimizeToTray')
        };
    });
}


// Inject audio event script into SoundCloud DOM
function setupAudioHandler() {
  contentView.webContents.on('did-finish-load', async () => {
    // Inject the track monitoring script
    try {
      await contentView.webContents.executeJavaScript(audioMonitorScript);
      console.log('Audio monitoring script injected successfully');
    } catch (error) {
      console.error('Failed to inject audio monitoring script:', error);
    }
  });

  ipcMain.on('soundcloud:track-update', async (_event, { data: result, reason }) => {
        console.debug(`Track update received: ${reason}`);
    
        // Only update if there are actual changes
        const hasChanges = JSON.stringify(result) !== JSON.stringify(lastTrackInfo);
        if (hasChanges) {
            lastTrackInfo = result;

            if (result.isPlaying && result.title && result.author && result.duration) {
                await lastFmService.updateTrackInfo({
                    title: result.title,
                    author: result.author,
                    duration: result.duration,
                });

                await webhookService.updateTrackInfo({
                    title: result.title,
                    author: result.author,
                    duration: result.duration,
                    url: result.url,
                    artwork: result.artwork,
                });
            }

            await presenceService.updatePresence(result);
            if (thumbarService)
                thumbarService.updateThumbarButtons(mainWindow, result.isPlaying, contentView);
        }
    });
}
