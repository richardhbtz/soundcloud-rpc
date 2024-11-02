const Store = require('electron-store');

import { app, BrowserWindow, Menu, dialog } from 'electron';
import { ElectronBlocker, fullLists } from '@cliqz/adblocker-electron';
import { readFileSync, writeFileSync } from 'fs';

import { DarkModeCSS } from './dark';
import { ActivityType } from 'discord-api-types/v10';
import { Client as DiscordClient } from '@xhayper/discord-rpc';

import { authenticateLastFm, getLastFmSession, scrobbleTrack, updateNowPlaying, shouldScrobble, timeStringToSeconds } from './lastfm';
import type { ScrobbleState } from './lastfm';
import fetch from 'cross-fetch';

const { autoUpdater } = require('electron-updater');
const localShortcuts = require('electron-localshortcut');
const prompt = require('electron-prompt');
const clientId = '1090770350251458592';
const store = new Store();


export interface Info {
    rpc: DiscordClient;
    ready: boolean;
    autoReconnect: boolean;
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', () => {
    injectToastNotification('Update Available');
});

autoUpdater.on('update-downloaded', () => {
    injectToastNotification('Update Completed');
});

const info: Info = {
    rpc: new DiscordClient({
        clientId,
    }),
    ready: false,
    autoReconnect: true,
};

info.rpc.login().catch(console.error);

Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow | null;
let blocker: ElectronBlocker;
let currentScrobbleState: ScrobbleState | null = null;

async function createWindow() {
    let displayWhenIdling = false; // Whether to display a status message when music is paused

    let bounds = store.get('bounds');
    let maximazed = store.get('maximazed');

    mainWindow = new BrowserWindow({
        width: bounds ? bounds.width : 1280,
        height: bounds ? bounds.height : 720,
        webPreferences: {
            nodeIntegration: false,
        },
    });

    if (maximazed) mainWindow.maximize();

    // Setup proxy
    if (store.get('proxyEnabled')) {
        const { protocol, host } = store.get('proxyData');

        await mainWindow.webContents.session.setProxy({
            proxyRules: `${protocol}//${host}`,
        });
    }

    // Load the SoundCloud website
    mainWindow.loadURL('https://soundcloud.com/discover');
    mainWindow.webContents.openDevTools();
    autoUpdater.checkForUpdates();

    const executeJS = (script: string) => mainWindow.webContents.executeJavaScript(script);

    // Wait for the page to fully load
    mainWindow.webContents.on('did-finish-load', async () => {
        if (store.get('darkMode')) {
            await mainWindow.webContents.insertCSS(DarkModeCSS);
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
                            author: authorEl?.innerText ?? ''
                        });
                    });
                `);
                    if (!trackInfo.title || !trackInfo.author) {
                        console.log('Incomplete track info:', trackInfo);
                        return;
                    }

                    const currentTrack = {
                        author: trackInfo.author as string,
                        title: trackInfo.title.replace(/\n.*/s, '').replace('Current track:', '') as string,
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
                        executeJS(`document.querySelector('.playbackTimeline__duration span:last-child')?.innerText ?? ''`),
                    ]);

                    await updateNowPlaying(currentTrack, store);

                    const parseTime = (time: string): number => {
                        const parts = time.split(':').map(Number);
                        return parts.reduce((acc, part) => 60 * acc + part, 0) * 1000;
                    };

                    const elapsedMilliseconds = parseTime(elapsedTime);
                    const totalMilliseconds = parseTime(totalTime);

                    if (!currentScrobbleState || 
                        currentScrobbleState.artist !== currentTrack.author || 
                        currentScrobbleState.title !== currentTrack.title) {
                        
                        // Scrobble previous track if it wasn't scrobbled and met criteria
                        if (currentScrobbleState && !currentScrobbleState.scrobbled && 
                            shouldScrobble(currentScrobbleState)) {
                            await scrobbleTrack({
                                author: currentScrobbleState.artist,
                                title: currentScrobbleState.title
                            }, store);
                        }
        
                        // Start tracking new track
                        currentScrobbleState = {
                            artist: currentTrack.author,
                            title: currentTrack.title,
                            startTime: Date.now(),
                            duration: timeStringToSeconds(trackInfo.duration),
                            scrobbled: false
                        };
                    } else if (currentScrobbleState && !currentScrobbleState.scrobbled && 
                              shouldScrobble(currentScrobbleState)) {
                        // Scrobble current track if it meets criteria
                        await scrobbleTrack({
                            author: currentScrobbleState.artist,
                            title: currentScrobbleState.title
                        }, store);
                        currentScrobbleState.scrobbled = true;
                    } 
                    
                    info.rpc.user?.setActivity({
                        type: ActivityType.Listening,
                        details: shortenString(currentTrack.title),
                        state: `by ${shortenString(trackInfo.author)}`,
                        largeImageKey: artworkUrl.replace('50x50.', '500x500.'),
                        largeImageText: currentTrack.title,
                        startTimestamp: Date.now() - elapsedMilliseconds,
                        endTimestamp: Date.now() + (totalMilliseconds - elapsedMilliseconds),
                        smallImageKey: 'soundcloud-logo',
                        smallImageText: 'SoundCloud',
                        instance: false,
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
        }, 10000);
    });

    // Emitted when the window is closed.
    mainWindow.on('close', function () {
        store.set('bounds', mainWindow.getBounds());
        store.set('maximazed', mainWindow.isMaximized());
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    // Register F1 shortcut for toggling dark mode
    localShortcuts.register(mainWindow, 'F1', () => toggleDarkMode());

    // Register F2 shortcut for toggling the adblocker
    localShortcuts.register(mainWindow, 'F2', () => toggleAdBlocker());

    // Register F3 shortcut to show the proxy window
    localShortcuts.register(mainWindow, 'F3', async () => toggleProxy());

    localShortcuts.register(mainWindow, 'F4', async () => {
        authenticateLastFm(mainWindow, store);
    });
    localShortcuts.register(mainWindow, ['CmdOrCtrl+B', 'CmdOrCtrl+P'], () => mainWindow.webContents.goBack());
    localShortcuts.register(mainWindow, ['CmdOrCtrl+F', 'CmdOrCtrl+N'], () => mainWindow.webContents.goForward());
}

// When Electron has finished initializing, create the main window
app.on('ready', createWindow);

// Quit the app when all windows are closed, unless running on macOS (where it's typical to leave apps running)
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// When the app is activated, create the main window if it doesn't already exist
app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
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
        const lastFmToken = await prompt({
            title: 'Last.fm Token',
            label: 'Enter the token you received after logging in to Last.fm',
            inputAttrs: {
                type: 'text',
            },
            type: 'input',
        });
        await getLastFmSession(lastFmToken, store);

        const { user, password } = store.get('proxyData');

        callback(user, password);
    }
});

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

//Function to toggle dark mode
function toggleDarkMode() {
    const darkModeEnabled = store.get('darkMode');
    store.set('darkMode', !darkModeEnabled);

    if (mainWindow) {
        mainWindow.reload();
        injectToastNotification(darkModeEnabled ? 'Dark mode disabled' : 'Dark mode enabled');
    }
}

function shortenString(str: string): string {
    return str.length > 128 ? str.substring(0, 128) + '...' : str;
}

// Function to inject toast notification into the main page
function injectToastNotification(message: string) {
    if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`
      const notificationElement = document.createElement('div');
      notificationElement.style.position = 'fixed';
      notificationElement.style.bottom = '50px';
      notificationElement.style.fontSize = '20px';
      notificationElement.style.left = '50%';
      notificationElement.style.transform = 'translateX(-50%)';
      notificationElement.style.backgroundColor = '#333';
      notificationElement.style.color = '#fff';
      notificationElement.style.padding = '10px 20px';
      notificationElement.style.borderRadius = '5px';
      notificationElement.style.opacity = '0'; 
      notificationElement.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        notificationElement.style.opacity = '1';
      }, 100); 
      notificationElement.innerHTML = '${message}';
      document.body.appendChild(notificationElement);
      setTimeout(() => {
        notificationElement.style.opacity = '0';
        setTimeout(() => {
          notificationElement.remove();
        }, 500); 
      }, 4500); // Duration of showing the notification
    `);
    }
}
