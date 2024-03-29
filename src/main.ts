import { app, BrowserWindow, Menu } from "electron";
import { Client as DiscordRPCClient } from "discord-rpc";

import { DarkModeCSS } from "./dark";

const localShortcuts = require("electron-localshortcut");
const Store = require("electron-store");
const store = new Store();

const rpc = new DiscordRPCClient({ transport: "ipc" });
const clientId = "1090770350251458592";

rpc.login({ clientId }).catch(console.error);

Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow | null;

function shortenString(str: string): string {
  return str.length > 128 ? str.substring(0, 128) + "..." : str;
}

async function createWindow() {
  let displayWhenIdling = false; // Whether to display a status message when music is paused

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  mainWindow.setBounds(store.get("bounds"));

  // Load the SoundCloud website
  mainWindow.loadURL("https://soundcloud.com/discover");

  // Wait for the page to fully load
  mainWindow.webContents.on("did-finish-load", async () => {
    // Inject dark mode CSS if enablede
    if (store.get("darkMode")) {
      await mainWindow.webContents.insertCSS(DarkModeCSS);
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
  mainWindow.on("close", function () {
    store.set("bounds", mainWindow.getBounds());
  });

  mainWindow.on("closed", function () {
    mainWindow = null;
  });

  // Register F1 shortcut for toggling dark mode
  localShortcuts.register(mainWindow, "F1", () => toggleDarkMode());
}

// When Electron has finished initializing, create the main window
app.on("ready", createWindow);

// Quit the app when all windows are closed, unless running on macOS (where it's typical to leave apps running)
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// When the app is activated, create the main window if it doesn't already exist
app.on("activate", function () {
  if (mainWindow === null) {
    createWindow();
  }
});

//Function to toggle dark mode
function toggleDarkMode() {
  const isDarkMode = store.get("darkMode");
  store.set("darkMode", !isDarkMode);
  if (mainWindow) {
    mainWindow.reload();
  }
}
