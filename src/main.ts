import { app, BrowserWindow, Menu, ipcMain, BrowserView, Tray, nativeImage, shell } from 'electron';
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
import { ThemeService } from './services/themeService';
import { ShortcutService } from './services/shortcutService';
import { PluginService } from './services/pluginService';
import { audioMonitorScript } from './services/audioMonitorService';
import { showHomepageConfirmDialog, updateDialogBounds } from './settings/confirmPopup';
import type { TrackInfo, TrackUpdateMessage } from './types';
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
        navigationControlsEnabled: false,
        trackParserEnabled: true,
        richPresencePreviewEnabled: false,
        autoUpdaterEnabled: true,
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
let themeService: ThemeService;
let shortcutService: ShortcutService;
let pluginService: PluginService;
let tray: Tray | null = null;
let isQuitting = false;
let memoryPressureHandlerRegistered = false;
const devMode = process.argv.includes('--dev');
// Header height for header BrowserView
const HEADER_HEIGHT = 32;
// macOS check
const isMas = process.mas === true;

// Add missing property to app
declare global {
    namespace NodeJS {
        interface Global {
            app: any;
        }
    }
}

// Multiple startup check
if (!isMas) {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
        process.exit(0);
    }
}

// Extend app with custom property
Object.defineProperty(app, 'isQuitting', {
    value: false,
    writable: true,
    configurable: true,
});

// Display settings
let displayWhenIdling = store.get('displayWhenIdling') as boolean;
let displaySCSmallIcon = store.get('displaySCSmallIcon') as boolean;

// Update handling
function setupUpdater() {
    if (!store.get('autoUpdaterEnabled', true)) {
        console.log('Auto-updater disabled by user setting');
        return;
    }

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
    const iconPath = path.join(
        RESOURCES_PATH,
        'icons',
        process.platform === 'win32' ? 'soundcloud-win.ico' : 'soundcloud.png',
    );
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
            },
        },
        {
            label: 'Settings',
            click: () => {
                if (settingsManager) {
                    settingsManager.toggle();
                }
            },
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            },
        },
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
            devTools: devMode,
            spellcheck: false,
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
let lastTrackInfo: TrackInfo = {
    title: '',
    author: '',
    artwork: '',
    elapsed: '',
    duration: '',
    isPlaying: false,
    url: '',
};

function setupWindowControls() {
    if (!mainWindow) return;

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

        updateDialogBounds(mainWindow);
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

    // Navigation handlers
    ipcMain.on('navigate-back', () => {
        if (contentView && contentView.webContents.navigationHistory.canGoBack()) {
            contentView.webContents.navigationHistory.goBack();
        }
    });

    ipcMain.on('navigate-forward', () => {
        if (contentView && contentView.webContents.navigationHistory.canGoForward()) {
            contentView.webContents.navigationHistory.goForward();
        }
    });

    ipcMain.on('refresh-page', () => {
        if (contentView) {
            if (headerView && headerView.webContents) {
                headerView.webContents.send('refresh-state-changed', true);
            }
            console.log('Manual refresh triggered - reloading page');
            contentView.webContents.reload();
        }
    });

    ipcMain.on('cancel-refresh', () => {
        if (contentView) {
            contentView.webContents.stop();
            if (headerView && headerView.webContents) {
                headerView.webContents.send('refresh-state-changed', false);
            }
        }
    });

    ipcMain.on('toggle-theme', () => {
        isDarkTheme = !isDarkTheme;
        if (headerView && headerView.webContents) {
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

    // Handle navigation controls enabled setting
    ipcMain.handle('get-navigation-controls-enabled', () => {
        return store.get('navigationControlsEnabled', false);
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
            sandbox: false,
            spellcheck: false,
            devTools: devMode,
            affinity: 'ui',
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
            preload: path.join(__dirname, 'preload.js'),
            spellcheck: false,
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
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    // Initialize services
    translationService = new TranslationService();
    themeService = new ThemeService(store);
    pluginService = new PluginService(store);
    pluginService.setContentView(contentView);
    // Hot-reload custom theme CSS when files change
    themeService.onCustomThemeUpdated(() => {
        applyThemeToContent(isDarkTheme);
    });
    notificationManager = new NotificationManager(mainWindow);
    settingsManager = new SettingsManager(mainWindow, store, translationService);
    proxyService = new ProxyService(mainWindow, store, queueToastNotification);
    presenceService = new PresenceService(store, translationService);
    lastFmService = new LastFmService(contentView, store);
    webhookService = new WebhookService(store);
    shortcutService = new ShortcutService(mainWindow);
    shortcutService.attachToWebContents(contentView.webContents);
    if (platform() === 'win32') thumbarService = new ThumbarService(translationService);

    setupMemoryPressureHandler();

    // Add settings toggle handler
    ipcMain.on('toggle-settings', () => {
        settingsManager.toggle();
    });

    ipcMain.handle('confirm-open-homepage', async (_event, url: string) => {
        if (!url || typeof url !== 'string') return false;
        const normalizedUrl = url.trim();
        if (!/^https?:\/\//i.test(normalizedUrl)) return false;

        const confirmed = await showHomepageConfirmDialog(mainWindow, normalizedUrl);
        if (confirmed) {
            await shell.openExternal(normalizedUrl);
        }

        return confirmed;
    });

    ipcMain.on('show-plugin-homepage-dialog', async (_event, url: string) => {
        if (!url || typeof url !== 'string') return;
        const normalizedUrl = url.trim();
        if (!/^https?:\/\//i.test(normalizedUrl)) return;

        const confirmed = await showHomepageConfirmDialog(mainWindow, normalizedUrl);
        if (confirmed) {
            await shell.openExternal(normalizedUrl);
        }
    });

    setupWindowControls();

    initializeShortcuts();

    setupThemeHandlers();
    setupTranslationHandlers();
    setupAudioHandler();

    // Provide current track info to settings preview on demand
    ipcMain.handle('get-current-track', () => {
        return lastTrackInfo;
    });

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

    // Function to update navigation state in header
    function updateNavigationState() {
        if (headerView && headerView.webContents && contentView) {
            const state = {
                canGoBack: contentView.webContents.navigationHistory.canGoBack(),
                canGoForward: contentView.webContents.navigationHistory.canGoForward(),
            };
            headerView.webContents.send('navigation-state-changed', state);
        }
    }

    // Listen for navigation events to update button states
    contentView.webContents.on('did-navigate', () => {
        updateNavigationState();
    });

    contentView.webContents.on('did-navigate-in-page', () => {
        updateNavigationState();
    });

    // Listen for page load events to manage refresh state
    contentView.webContents.on('did-start-loading', () => {
        if (headerView && headerView.webContents) {
            headerView.webContents.send('refresh-state-changed', true);
        }
    });

    contentView.webContents.on('did-stop-loading', () => {
        if (headerView && headerView.webContents) {
            headerView.webContents.send('refresh-state-changed', false);
        }
        updateNavigationState();
    });

    contentView.webContents.on('did-fail-load', () => {
        if (headerView && headerView.webContents) {
            headerView.webContents.send('refresh-state-changed', false);
        }
        updateNavigationState();
    });

    // Initialize adblocker once
    if (store.get('adBlocker')) {
        try {
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
            blocker.enableBlockingInSession(contentView.webContents.session);
        } catch (error) {
            console.error('Failed to initialize adblocker:', error);
        }
    }

    // Track if this is initial load
    let isInitialLoad = true;

    // Setup event handlers
    contentView.webContents.on('did-finish-load', async () => {
        await lastFmService.authenticate();

        // Get the current language from the page FIRST
        await getLanguage();

        // Show notification only on first load
        if (isInitialLoad) {
            notificationManager.show(translationService.translate('pressF1ToOpenSettings'));
            isInitialLoad = false;
        }

        // Update the language in the settings manager
        settingsManager.updateTranslations(translationService);

        // Update navigation state after page load
        updateNavigationState();

        // Initialize navigation controls visibility
        const navigationEnabled = store.get('navigationControlsEnabled', false);
        if (headerView && headerView.webContents) {
            headerView.webContents.send('navigation-controls-toggle', navigationEnabled);
        }

        // Reinitialize after page load/refresh
        await reinitializeAfterPageLoad();
    });

    // Reinitialize everything after page load/refresh
    async function reinitializeAfterPageLoad() {
        try {
            // Reapply theme to content after page reload
            applyThemeToContent(isDarkTheme);

            // Inject audio monitoring script
            await contentView.webContents.executeJavaScript(audioMonitorScript);

            // Re-inject all enabled plugin content scripts
            if (pluginService) {
                pluginService.injectAllContentScripts();
            }

            if (presenceService) {
                await presenceService.updatePresence(lastTrackInfo as any);
            }
        } catch (error) {
            console.error('Failed to reinitialize after page load:', error);
        }
    }

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
        } else if (key === 'navigationControlsEnabled') {
            if (headerView && headerView.webContents) {
                headerView.webContents.send('navigation-controls-toggle', data.value);
            }
        } else if (key === 'autoUpdaterEnabled') {
            if (data.value) {
                setupUpdater();
            } else {
                console.log('Auto-updater disabled by user');
            }
        } else if (key === 'customTheme') {
            if (data.value === 'none') {
                themeService.removeCustomTheme();
            } else {
                themeService.applyCustomTheme(data.value);
            }
            // Re-apply the theme to all content
            applyThemeToContent(isDarkTheme);
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

function setupMemoryPressureHandler() {
    if (memoryPressureHandlerRegistered) return;
    memoryPressureHandlerRegistered = true;

    app.on('memory-pressure', async (_event, details) => {
        const level = typeof details === 'string' ? details : 'unknown';
        console.warn(`Memory pressure detected (${level}). Clearing caches and history.`);

        if (contentView) {
            contentView.webContents.clearHistory();
        }

        const session = contentView?.webContents.session;
        if (!session) return;

        try {
            await session.clearCache();
        } catch (error) {
            console.warn('Failed to clear HTTP cache:', error);
        }

        try {
            await session.clearStorageData({ storages: ['cachestorage'] });
        } catch (error) {
            console.warn('Failed to clear Cache Storage:', error);
        }
    });
}

function setupThemeHandlers() {
    // Load initial theme from store
    isDarkTheme = store.get('theme', 'dark') === 'dark';

    // Send initial theme to all views
    if (headerView && headerView.webContents) {
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

            if (pluginService) {
                pluginService.notifyThemeChange(isDarkTheme);
            }

            // Update all views
            if (headerView && headerView.webContents) {
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

    const customThemeCSS = themeService.getCurrentCustomThemeCSS();
    const themeColors = themeService.getCurrentThemeColors();

    // Update theme colors for all UI components
    if (notificationManager) {
        notificationManager.setThemeColors(themeColors);
    }
    if (settingsManager) {
        settingsManager.setThemeColors(themeColors);
    }
    if (headerView && headerView.webContents) {
        headerView.webContents.send('theme-colors-changed', themeColors);
    }

    // Split CSS into sections using comment markers in the theme file:
    // /* @target all|content|header|settings */ ... /* @end */
    const sections = (function splitSections(css: string | null) {
        const res = { all: '', content: '', header: '', settings: '' } as Record<string, string>;
        if (!css) return res;
        const regex =
            /\/\*\s*@target\s+(all|content|header|settings)\s*\*\/[\s\S]*?(?=(\/\*\s*@target\s+(?:all|content|header|settings)\s*\*\/)|$)/gi;
        let match: RegExpExecArray | null;
        let any = false;
        while ((match = regex.exec(css)) !== null) {
            any = true;
            const block = match[0];
            const targetMatch = /@target\s+(all|content|header|settings)/i.exec(block);
            const target = (targetMatch?.[1] || '').toLowerCase();
            const body = block.replace(/^[\s\S]*?\*\//, '').trim();
            res[target] += (res[target] ? '\n' : '') + body;
        }
        if (!any) {
            // No markers: treat entire CSS as content
            res.content = css;
        }
        return res;
    })(customThemeCSS);

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

                // Apply custom theme CSS (content section + all) if available
                const contentCSS = \`${sections.all + (sections.all && sections.content ? '\n' : '') + sections.content || ''}\`;
                if (contentCSS.trim()) {
                    const customStyle = document.createElement('style');
                    customStyle.id = 'custom-theme-style';
                    customStyle.textContent = contentCSS;
                    
                    const existingCustomStyle = document.getElementById('custom-theme-style');
                    if (existingCustomStyle) {
                        existingCustomStyle.remove();
                    }
                    document.head.appendChild(customStyle);
                    console.log('Applied custom theme CSS');
                } else {
                    // Remove custom theme if none is selected
                    const existingCustomStyle = document.getElementById('custom-theme-style');
                    if (existingCustomStyle) {
                        existingCustomStyle.remove();
                        console.log('Removed custom theme CSS');
                    }
                }
            } catch(e) {
                console.error('Error applying theme:', e);
            }
        })();
    `;

    contentView.webContents.executeJavaScript(themeScript).catch(console.error);

    // Also inject into header and settings views using their specific sections
    const headerCSS = sections.all + (sections.all && sections.header ? '\n' : '') + sections.header || '';
    if (headerView && headerView.webContents) {
        const headerScript = `
            (function(){
                try {
                    const css = \`${headerCSS}\`;
                    const id = 'custom-theme-style';
                    const existing = document.getElementById(id);
                    if (existing) existing.remove();
                    if (css.trim()){
                        const style = document.createElement('style');
                        style.id = id;
                        style.textContent = css;
                        document.head.appendChild(style);
                        console.log('Applied custom header theme CSS');
                    }
                } catch(e){ console.error('Header theme inject error:', e); }
            })();
        `;
        headerView.webContents.executeJavaScript(headerScript).catch(console.error);
    }

    if (settingsManager) {
        const settingsCSS = sections.all + (sections.all && sections.settings ? '\n' : '') + sections.settings || '';
        const settingsScript = `
            (function(){
                try {
                    const css = \`${settingsCSS}\`;
                    const id = 'custom-theme-style';
                    const existing = document.getElementById(id);
                    if (existing) existing.remove();
                    if (css.trim()){
                        const style = document.createElement('style');
                        style.id = id;
                        style.textContent = css;
                        document.head.appendChild(style);
                        console.log('Applied custom settings theme CSS');
                    }
                } catch(e){ console.error('Settings theme inject error:', e); }
            })();
        `;
        settingsManager.getView().webContents.executeJavaScript(settingsScript).catch(console.error);
    }
}

function initializeShortcuts() {
    if (!mainWindow || !contentView || !settingsManager) return;

    shortcutService.register('openSettings', 'F1', 'Open Settings', () => settingsManager.toggle());

    if (devMode) {
        shortcutService.register('devTools', 'F12', 'Open Developer Tools', () => {
            if (contentView) contentView.webContents.openDevTools();
        });
    }

    shortcutService.register('zoomIn', 'CommandOrControl+=', 'Zoom In', () => {
        if (!contentView) return;
        const zoomLevel = contentView.webContents.getZoomLevel();
        contentView.webContents.setZoomLevel(Math.min(zoomLevel + 1, 9));
    });

    shortcutService.register('zoomOut', 'CommandOrControl+-', 'Zoom Out', () => {
        if (!contentView) return;
        const zoomLevel = contentView.webContents.getZoomLevel();
        contentView.webContents.setZoomLevel(Math.max(zoomLevel - 1, -9));
    });

    shortcutService.register('zoomReset', 'CommandOrControl+0', 'Reset Zoom', () => {
        if (contentView) contentView.webContents.setZoomLevel(0);
    });

    shortcutService.register('goBack', 'CommandOrControl+B', 'Go Back', () => {
        if (contentView && contentView.webContents.navigationHistory.canGoBack()) {
            contentView.webContents.navigationHistory.goBack();
        }
    });

    shortcutService.register('goBackAlt', 'CommandOrControl+P', 'Go Back (Alternative)', () => {
        if (contentView && contentView.webContents.navigationHistory.canGoBack()) {
            contentView.webContents.navigationHistory.goBack();
        }
    });

    shortcutService.register('goForward', 'CommandOrControl+F', 'Go Forward', () => {
        if (contentView && contentView.webContents.navigationHistory.canGoForward()) {
            contentView.webContents.navigationHistory.goForward();
        }
    });

    shortcutService.register('goForwardAlt', 'CommandOrControl+N', 'Go Forward (Alternative)', () => {
        if (contentView && contentView.webContents.navigationHistory.canGoForward()) {
            contentView.webContents.navigationHistory.goForward();
        }
    });

    shortcutService.register('refresh', 'CommandOrControl+R', 'Refresh Page', () => {
        if (contentView) {
            if (headerView && headerView.webContents) {
                headerView.webContents.send('refresh-state-changed', true);
            }
            contentView.webContents.reload();
        }
    });

    console.log(`Initialized ${shortcutService.count} keyboard shortcuts`);
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
    if (shortcutService) {
        shortcutService.destroy();
    }
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

// focus the window when the second instance is opened.
app.on('second-instance', () => {
    if (!mainWindow) {
        return;
    }
    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    mainWindow.focus();
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
            lastfm: translationService.translate('lastfm'),
            lastFmApiKey: translationService.translate('lastFmApiKey'),
            lastFmSecret: translationService.translate('lastFmApiSecret'),
            createApiKeyLastFm: translationService.translate('createApiKeyLastFm'),
            noCallbackUrl: translationService.translate('noCallbackUrl'),
            webhooks: translationService.translate('webhooks'),
            discord: translationService.translate('discord'),
            enableWebhooks: translationService.translate('enableWebhooks'),
            webhookUrl: translationService.translate('webhookUrl'),
            webhookTrigger: translationService.translate('webhookTrigger'),
            webhookDescription: translationService.translate('webhookDescription'),
            showWebhookExample: translationService.translate('showWebhookExample'),
            enableRichPresence: translationService.translate('enableRichPresence'),
            displayWhenPaused: translationService.translate('displayWhenPaused'),
            displaySmallIcon: translationService.translate('displaySmallIcon'),
            displayButtons: translationService.translate('displayButtons'),
            useArtistInStatusLine: translationService.translate('useArtistInStatusLine'),
            enableRichPresencePreview: translationService.translate('enableRichPresencePreview'),
            richPresencePreview: translationService.translate('richPresencePreview'),
            richPresencePreviewDescription: translationService.translate('richPresencePreviewDescription'),
            applyChanges: translationService.translate('applyChanges'),
            minimizeToTray: translationService.translate('minimizeToTray'),
            enableNavigationControls: translationService.translate('enableNavigationControls'),
            enableTrackParser: translationService.translate('enableTrackParser'),
            trackParserDescription: translationService.translate('trackParserDescription'),
            enableAutoUpdater: translationService.translate('enableAutoUpdater'),
            customThemes: translationService.translate('customThemes'),
            selectCustomTheme: translationService.translate('selectCustomTheme'),
            noTheme: translationService.translate('noTheme'),
            openThemesFolder: translationService.translate('openThemesFolder'),
            refreshThemes: translationService.translate('refreshThemes'),
            customThemeDescription: translationService.translate('customThemeDescription'),
            plugins: translationService.translate('plugins'),
            openPluginsFolder: translationService.translate('openPluginsFolder'),
            refreshPlugins: translationService.translate('refreshPlugins'),
            pluginsDescription: translationService.translate('pluginsDescription'),
            noPluginsFound: translationService.translate('noPluginsFound'),
            pressF1ToOpenSettings: translationService.translate('pressF1ToOpenSettings'),
            closeSettings: translationService.translate('closeSettings'),
            noActivityToShow: translationService.translate('noActivityToShow'),
            richPresencePreviewTitle: translationService.translate('richPresencePreviewTitle'),
        };
    });
}

// Setup audio event handler for track updates
function setupAudioHandler() {
    ipcMain.on('soundcloud:track-update', async (_event, { data: result, reason }: TrackUpdateMessage) => {
        if (devMode) {
            console.debug(`Track update received: ${reason}`);
        }

        lastTrackInfo = result;

        if (pluginService) {
            pluginService.notifyTrackChange(result as unknown as Record<string, unknown>);
        }

        // Update services on track update
        if (result.title && result.author && result.duration) {
            await Promise.all([
                lastFmService.updateTrackInfo(
                    {
                        title: result.title,
                        author: result.author,
                        duration: result.duration,
                        elapsed: result.elapsed,
                    },
                    result.isPlaying,
                ),
                webhookService.updateTrackInfo(
                    {
                        title: result.title,
                        author: result.author,
                        duration: result.duration,
                        url: result.url,
                        artwork: result.artwork,
                        elapsed: result.elapsed,
                    },
                    result.isPlaying,
                ),
                presenceService.updatePresence(result),
            ]);
        } else {
            await presenceService.updatePresence(result);
        }

        // Update the rich presence preview in settings
        if (settingsManager) {
            settingsManager.getView().webContents.send('presence-preview-update', result);
        }

        if (thumbarService) {
            thumbarService.updateThumbarButtons(mainWindow, result.isPlaying, contentView);
        }
    });
}
