import { app, BrowserWindow, Menu } from "electron";
import { Client as DiscordRPCClient } from "discord-rpc";
import { ElectronBlocker, fullLists } from '@cliqz/adblocker-electron';
import { readFileSync, writeFileSync } from 'fs';
import fetch from 'cross-fetch';

import { DarkModeCSS } from "./dark";

const localShortcuts = require("electron-localshortcut");
const Store = require("electron-store");

const store = new Store();
const rpc = new DiscordRPCClient({ transport: "ipc" });
const clientId = "1090770350251458592";

rpc.login({ clientId }).catch(console.error);

Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow | null;
let blocker: ElectronBlocker;

async function createWindow() {
  let displayWhenIdling = false; // Whether to display a status message when music is paused

  let bounds = store.get("bounds");

  mainWindow = new BrowserWindow({
    width: bounds ? bounds.width : 1280,
    height: bounds ? bounds.height : 720,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  // Load the SoundCloud website
  mainWindow.loadURL("https://soundcloud.com/discover");

  // Wait for the page to fully load
  mainWindow.webContents.on("did-finish-load", async () => {

    // Inject dark mode CSS if enabled
    if (store.get("darkMode")) {
      await mainWindow.webContents.insertCSS(DarkModeCSS);
    }

    // Inject adblocker if enabled
    if (store.get("adBlocker")) {
      blocker = await ElectronBlocker.fromLists(
        fetch,
        fullLists,
        {
          enableCompression: true,
        },
        {
          path: 'engine.bin',
          read: async (...args) => readFileSync(...args),
          write: async (...args) => writeFileSync(...args),
        },
      )
      blocker.enableBlockingInSession(mainWindow.webContents.session);
    }

    // Check if music is playing every 10 seconds
    setInterval(async () => {
      // Check if music is playing
      const isPlaying = await mainWindow.webContents.executeJavaScript(
        `document.querySelector('.playControls__play').classList.contains('playing')`,
      );

      if (isPlaying) {
        // Retrieve the track title using a script injected into the page
        const trackInfo = await mainWindow.webContents.executeJavaScript(`
        new Promise(resolve => {
          const titleEl = document.querySelector('.playbackSoundBadge__titleLink');
          const authorEl = document.querySelector('.playbackSoundBadge__lightLink');
          if (titleEl && authorEl) {
            resolve({title: titleEl.innerText, author: authorEl.innerText});
          } else {
            resolve({title: '', author: ''});
          }
        });
      `);

        // Retrieve the URL of the song's artwork image
        const artworkUrl = await mainWindow.webContents.executeJavaScript(`
        new Promise(resolve => {
          const artworkEl = document.querySelector('.playbackSoundBadge__avatar .image__lightOutline span');
          if (artworkEl) {
            const url = artworkEl.style.backgroundImage.replace('url("', '').replace('")', '');
            resolve(url);
          } else {
            resolve('');
          }
        });
      `);

        const currentTrack = trackInfo.title
          .replace(/\n.*/s, "")
          .replace("Current track:", "");

        // Update rich presence with the currently playing song
        rpc.setActivity({
          details: shortenString(currentTrack),
          state: `by ${shortenString(trackInfo.author)}`,
          largeImageKey: artworkUrl.replace("50x50.", "500x500."),
          largeImageText: currentTrack,
          smallImageKey: "soundcloud-logo",
          smallImageText: "SoundCloud",
          instance: false,
        });
      } else {
        if (displayWhenIdling) {
          // Update rich presence when music is paused
          rpc.setActivity({
            details: "Listening to SoundCloud",
            state: "Paused",
            largeImageKey: "idling",
            largeImageText: "Paused",
            smallImageKey: "soundcloud-logo",
            smallImageText: "SoundCloud",
            instance: false,
          });
        } else {
          rpc.clearActivity();
        }
      }
    }, 10000); // Check every 10 seconds
  });

  // Emitted when the window is closed.
  mainWindow.on("close", function() {
    store.set("bounds", mainWindow.getBounds());
  });

  mainWindow.on("closed", function() {
    mainWindow = null;
  });

  // Register F1 shortcut for toggling dark mode
  localShortcuts.register(mainWindow, "F1", () => toggleDarkMode());

  // Register F2 shortcut for toggling the adblocker
  localShortcuts.register(mainWindow, "F2", () => toggleAdBlocker());
}

// When Electron has finished initializing, create the main window
app.on("ready", createWindow);

// Quit the app when all windows are closed, unless running on macOS (where it's typical to leave apps running)
app.on("window-all-closed", function() {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// When the app is activated, create the main window if it doesn't already exist
app.on("activate", function() {
  if (mainWindow === null) {
    createWindow();
  }
});

//Function to toggle the adblocker
function toggleAdBlocker() {
  const adBlockEnabled = store.get("adBlocker");
  store.set("adBlocker", !adBlockEnabled);

  if (adBlockEnabled) {
    blocker.disableBlockingInSession(mainWindow.webContents.session);
  }

  if (mainWindow) {
    mainWindow.reload();
    injectToastNotification(adBlockEnabled ? "Adblocker disabled" : "Adblocker enabled");
  }
}

//Function to toggle dark mode
function toggleDarkMode() {
  const darkModeEnabled = store.get("darkMode");
  store.set("darkMode", !darkModeEnabled);

  if (mainWindow) {
    mainWindow.reload();
    injectToastNotification(darkModeEnabled ? "Dark mode disabled" : "Dark mode enabled");
  }
}

function shortenString(str: string): string {
  return str.length > 128 ? str.substring(0, 128) + "..." : str;
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
