const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    toggleTheme: () => ipcRenderer.send('toggle-theme'),
    onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (_, value) => callback(value)),
    getInitialState: () => ipcRenderer.send('get-initial-state'),
});