const Store = require('electron-store');

import { app, BrowserWindow, dialog, Menu, nativeImage } from 'electron';
import { ElectronBlocker, fullLists } from '@cliqz/adblocker-electron';
import { readFileSync, writeFileSync } from 'fs';

import { ActivityType } from 'discord-api-types/v10';
import { Client as DiscordClient } from '@xhayper/discord-rpc';

import {
    authenticateLastFm,
    scrobbleTrack,
    updateNowPlaying,
    shouldScrobble,
    timeStringToSeconds,
} from './lastfm/lastfm';

import { setupLastFmConfig } from './lastfm/lastfm-auth';
import type { ScrobbleState } from './lastfm/lastfm';

import fetch from 'cross-fetch';
import { setupDarwinMenu } from './macos/menu';
import { NotificationManager } from './notifications/notificationManager';

import path from 'path';
import { TranslationService } from './services/translationService';

const { autoUpdater } = require('electron-updater');
const windowStateManager = require('electron-window-state');
const localShortcuts = require('electron-localshortcut');
const prompt = require('electron-prompt');
const clientId = '1090770350251458592';
const store = new Store();

export interface Info {
    rpc: DiscordClient;
    ready: boolean;
    autoReconnect: boolean;
}

const info: Info = {
    rpc: new DiscordClient({
        clientId,
    }),
    ready: false,
    autoReconnect: true,
};

info.rpc.login().catch(console.error);

let mainWindow: BrowserWindow | null;
let blocker: ElectronBlocker;
let currentScrobbleState: ScrobbleState | null = null;
let notificationManager: NotificationManager;
let translationService = new TranslationService();

let displayWhenIdling = false; // Whether to display a status message when music is paused
let displaySCSmallIcon = false; // Whether to display the small SoundCloud logo

function setupUpdater() {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', () => {
        injectToastNotification('Update Available');
    });

    autoUpdater.on('update-downloaded', () => {
        injectToastNotification('Update Completed');
    });

    autoUpdater.checkForUpdates();
}

// Update the language when retrieved from the web page
async function getLanguage(win: BrowserWindow | null) {
    if (!win) return;

    const langInfo = await win.webContents.executeJavaScript(`
        const langEl = document.querySelector('html');
        new Promise(resolve => {
            resolve({
                lang: langEl ? langEl.getAttribute('lang') : 'en',
            });
        })
    `);

    translationService.setLanguage(langInfo.lang);
}

// Set thumbar buttons for the media controls
function updateThumbarButtons(win: BrowserWindow | null, isPlaying: any) {
    if (!win) return;

    const backwardIcon = nativeImage.createFromPath(path.join(__dirname, '../assets/icons/backward.ico'));
    const playIcon = nativeImage.createFromPath(path.join(__dirname, '../assets/icons/play.ico'));
    const pauseIcon = nativeImage.createFromPath(path.join(__dirname, '../assets/icons/pause.ico'));
    const forwardIcon = nativeImage.createFromPath(path.join(__dirname, '../assets/icons/forward.ico'));

    win.setThumbarButtons([
        {
            tooltip: translationService.translate('previous'),
            icon: backwardIcon,
            click: () => {
                mainWindow.webContents.executeJavaScript(`
                    document.querySelector('.skipControl__previous')?.click();
                  `);
            }
        },
        {
            tooltip: isPlaying ? translationService.translate('pause') : translationService.translate('play'),
            icon: isPlaying ? pauseIcon : playIcon,
            click: () => {
                isPlaying = !isPlaying;
                updateThumbarButtons(win, isPlaying);
                mainWindow.webContents.executeJavaScript(`
                    document.querySelector('.playControl')?.click();
                  `);
            }
        },
        {
            tooltip: translationService.translate('next'),
            icon: forwardIcon,
            click: () => {
                mainWindow.webContents.executeJavaScript(`
                    document.querySelector('.skipControl__next')?.click();
                  `);
            }
        }
    ]);
}

async function init() {
    setupUpdater();

    if (process.platform === 'darwin') setupDarwinMenu();
    else Menu.setApplicationMenu(null);

    let windowState = windowStateManager({ defaultWidth: 800, defaultHeight: 800 });

    mainWindow = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        webPreferences: {
            nodeIntegration: false,
        },
    });

    notificationManager = new NotificationManager(mainWindow);

    windowState.manage(mainWindow);

    mainWindow.webContents.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    // Setup proxy
    if (store.get('proxyEnabled')) {
        const { protocol, host } = store.get('proxyData');

        await mainWindow.webContents.session.setProxy({
            proxyRules: `${protocol}//${host}`,
        });
    }

    // Load the SoundCloud website
    mainWindow.loadURL('https://soundcloud.com/discover');

    const executeJS = (script: string) => mainWindow.webContents.executeJavaScript(script);

    // Wait for the page to fully load
    mainWindow.webContents.on('did-finish-load', async () => {
        const apikey = store.get('lastFmApiKey');
        const secret = store.get('lastFmSecret');

        if (apikey && secret && mainWindow.webContents.getURL().startsWith('https://soundcloud.com/')) {
            await authenticateLastFm(mainWindow, store);
            injectToastNotification('Last.fm authenticated');
        }

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

        await getLanguage(mainWindow);

        const isPlaying = await executeJS(`
            document.querySelector('.playControls__play').classList.contains('playing')
        `);

        updateThumbarButtons(mainWindow, isPlaying);

        setInterval(async () => {
            try {
                const isPlaying = await executeJS(`
                    document.querySelector('.playControls__play').classList.contains('playing')
                `);

                if (isPlaying) {
                    const trackInfo = await executeJS(`
                    new Promise(resolve => {
                        const titleEl = document.querySelector('.playbackSoundBadge__titleLink');
                        const authorEl = document.querySelector('.playbackSoundBadge__lightLink');
                        resolve({
                            title: titleEl?.innerText ?? '',
                            author: authorEl?.innerText ?? '',
                            url: titleEl?.href ?? ''
                        });
                    });
                `);
                    if (!trackInfo.title || !trackInfo.author) {
                        console.log('Incomplete track info:', trackInfo);
                        return;
                    }

                    const currentTrack = {
                        author: trackInfo.author as string,
                        title: trackInfo.title
                            .replace(/.*?:\s*/, '') // Remove everything up to and including the first colon.
                            .replace(/\n.*/, '') // Remove everything after the first newline.
                            .trim() as string, // Clean up any leading/trailing spaces.
                        url: trackInfo.url as string
                    };

                    const artworkUrl = await executeJS(`
                    new Promise(resolve => {
                        const artworkEl = document.querySelector('.playbackSoundBadge__avatar .image__lightOutline span');
                        resolve(artworkEl ? artworkEl.style.backgroundImage.slice(5, -2) : '');
                    });
                `);

                    const [elapsedTime, totalTime] = await Promise.all([
                        executeJS(
                            `document.querySelector('.playbackTimeline__timePassed span:last-child')?.innerText ?? ''`,
                        ),
                        executeJS(
                            `document.querySelector('.playbackTimeline__duration span:last-child')?.innerText ?? ''`,
                        ),
                    ]); //;

                    await updateNowPlaying(currentTrack, store);

                    const parseTime = (time: string): number => {
                        const parts = time.split(':').map(Number);
                        return parts.reduce((acc, part) => 60 * acc + part, 0) * 1000;
                    };

                    const elapsedMilliseconds = parseTime(elapsedTime);
                    const totalMilliseconds = parseTime(totalTime);

                    if (
                        !currentScrobbleState ||
                        currentScrobbleState.artist !== currentTrack.author ||
                        currentScrobbleState.title !== currentTrack.title
                    ) {
                        // Scrobble previous track if it wasn't scrobbled and met criteria
                        if (
                            currentScrobbleState &&
                            !currentScrobbleState.scrobbled &&
                            shouldScrobble(currentScrobbleState)
                        ) {
                            await scrobbleTrack(
                                {
                                    author: currentScrobbleState.artist,
                                    title: currentScrobbleState.title,
                                },
                                store,
                            );
                        }

                        // Start tracking new track
                        currentScrobbleState = {
                            artist: currentTrack.author,
                            title: currentTrack.title,
                            startTime: Date.now(),
                            duration: timeStringToSeconds(trackInfo.duration),
                            scrobbled: false,
                        };
                    } else if (
                        currentScrobbleState &&
                        !currentScrobbleState.scrobbled &&
                        shouldScrobble(currentScrobbleState)
                    ) {
                        // Scrobble current track if it meets criteria
                        await scrobbleTrack(
                            {
                                author: currentScrobbleState.artist,
                                title: currentScrobbleState.title,
                            },
                            store,
                        );
                        currentScrobbleState.scrobbled = true;
                    }

                    if (!info.rpc.isConnected) {
                        if (await !info.rpc.login().catch(console.error)) {
                            return;
                        }
                    }

                    info.rpc.user?.setActivity({
                        type: ActivityType.Listening,
                        details: `${shortenString(currentTrack.title)}${currentTrack.title.length < 2 ? '⠀⠀' : ''}`,
                        state: `${shortenString(trackInfo.author)}${trackInfo.author.length < 2 ? '⠀⠀' : ''}`,
                        largeImageKey: artworkUrl.replace('50x50.', '500x500.'),
                        startTimestamp: Date.now() - elapsedMilliseconds,
                        endTimestamp: Date.now() + (totalMilliseconds - elapsedMilliseconds),
                        smallImageKey: displaySCSmallIcon ? 'soundcloud-logo' : '',
                        smallImageText: displaySCSmallIcon ? 'SoundCloud' : '',
                        instance: false,
                        buttons: [
                            {
                                label: `▶️ ${translationService.translate('listenOnSoundcloud')}`,
                                url: currentTrack.url
                            }
                        ]
                    });
                } else if (displayWhenIdling) {
                    info.rpc.user?.setActivity({
                        details: 'Listening to SoundCloud',
                        state: 'Paused',
                        largeImageKey: 'idling',
                        largeImageText: 'Paused',
                        smallImageKey: 'soundcloud-logo',
                        smallImageText: 'SoundCloud',
                        instance: false,
                    });
                } else {
                    info.rpc.user?.clearActivity();
                }
            } catch (error) {
                console.error('Error during RPC update:', error);
            }
        }, 5000);
    });

    // Emitted when the window is closed.
    mainWindow.on('close', function () {
        store.set('bounds', mainWindow.getBounds());
        store.set('maximazed', mainWindow.isMaximized());
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });


    // Register F2 shortcut for toggling the adblocker
    localShortcuts.register(mainWindow, 'F2', () => toggleAdBlocker());

    localShortcuts.register(mainWindow, 'F12', () => {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    });

    // Register F3 shortcut to show the proxy window
    localShortcuts.register(mainWindow, 'F3', async () => toggleProxy());

    // Register F4 shortcut to connecting to last.fm api
    localShortcuts.register(mainWindow, 'F4', async () => {
        const apikey = store.get('lastFmApiKey');
        const secret = store.get('lastFmSecret');
        if (!apikey || !secret) {
            await setupLastFmConfig(mainWindow, store);
        } else {
            await authenticateLastFm(mainWindow, store);
            injectToastNotification('Last.fm authenticated');
        }
    });

    localShortcuts.register(mainWindow, 'F6', async () => {
        store.delete('lastFmApiKey');
        store.delete('lastFmSecret');
        mainWindow.webContents.reload();
    });

    let zoomLevel = mainWindow.webContents.getZoomLevel();

    // Zoom In (Ctrl + +)
    localShortcuts.register(mainWindow, 'CmdOrCtrl+=', () => {
        zoomLevel = Math.min(zoomLevel + 1, 9); // Limit zoom level to 9
        mainWindow.webContents.setZoomLevel(zoomLevel);
    });

    // Zoom Out (Ctrl + -)
    localShortcuts.register(mainWindow, 'CmdOrCtrl+-', () => {
        zoomLevel = Math.max(zoomLevel - 1, -9); // Limit zoom level to -9
        mainWindow.webContents.setZoomLevel(zoomLevel);
    });

    // Reset Zoom (Ctrl + 0)
    localShortcuts.register(mainWindow, 'CmdOrCtrl+0', () => {
        zoomLevel = 0; // Reset zoom level to default
        mainWindow.webContents.setZoomLevel(zoomLevel);
    });

    localShortcuts.register(mainWindow, ['CmdOrCtrl+B', 'CmdOrCtrl+P'], () => mainWindow.webContents.goBack());
    localShortcuts.register(mainWindow, ['CmdOrCtrl+F', 'CmdOrCtrl+N'], () => mainWindow.webContents.goForward());
}

// When Electron has finished initializing, create the main window
app.on('ready', init);

// Quit the app when all windows are closed, unless running on macOS (where it's typical to leave apps running)
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// When the app is activated, create the main window if it doesn't already exist
app.on('activate', function () {
    if (mainWindow === null) {
        init();
    }
});

//Function to toggle the adblocker
function toggleAdBlocker() {
    const adBlockEnabled = store.get('adBlocker');
    store.set('adBlocker', !adBlockEnabled);

    if (adBlockEnabled) {
        if (blocker) blocker.disableBlockingInSession(mainWindow.webContents.session);
    }

    if (mainWindow) {
        mainWindow.reload();
        injectToastNotification(adBlockEnabled ? 'Adblocker disabled' : 'Adblocker enabled');
    }
}

// Handle proxy authorization
app.on('login', async (_event, _webContents, _request, authInfo, callback) => {
    if (authInfo.isProxy) {
        if (!store.get('proxyEnabled')) {
            return callback('', '');
        }

        const { user, password } = store.get('proxyData');

        callback(user, password);
    }
});

function shortenString(str: string): string {
    return str.length > 128 ? str.substring(0, 128) + '...' : str;
}

// Function to toggle proxy
async function toggleProxy() {
    const proxyUri = await prompt({
        title: 'Setup Proxy',
        label: "Enter 'off' to disable the proxy",
        value: 'http://user:password@ip:port',
        inputAttrs: {
            type: 'uri',
        },
        type: 'input',
    });

    if (proxyUri === null) return;

    if (proxyUri == 'off') {
        store.set('proxyEnabled', false);

        dialog.showMessageBoxSync(mainWindow, { message: 'The application needs to restart to work properly' });
        app.quit();
    } else {
        try {
            const url = new URL(proxyUri);
            store.set('proxyEnabled', true);
            store.set('proxyData', {
                protocol: url.protocol,
                host: url.host,
                user: url.username,
                password: url.password,
            });
            dialog.showMessageBoxSync(mainWindow, { message: 'The application needs to restart to work properly' });
            app.quit();
        } catch (e) {
            store.set('proxyEnabled', false);
            mainWindow.reload();
            injectToastNotification('Failed to setup proxy.');
        }
    }
}

// Function to inject toast notification into the main page
export function injectToastNotification(message: string) {
    if (mainWindow && notificationManager) {
        notificationManager.show(message);
    }
}
