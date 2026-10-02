import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const SEND_CHANNELS = new Set([
    'cancel-refresh',
    'close-window',
    'maximize-window',
    'minimize-window',
    'navigate-back',
    'navigate-forward',
    'navigate-url',
    'refresh-page',
    'tab-close',
    'tab-move',
    'tab-new',
    'tab-select',
    'title-bar-double-click',
    'toggle-downloads',
]);

const INVOKE_CHANNELS = new Set([
    'get-download-button-enabled',
    'get-navigation-controls-enabled',
    'get-tab-state',
    'get-theme-colors',
    'is-maximized',
]);

const ON_CHANNELS = new Set([
    'download-button-toggle',
    'downloads-active',
    'focus-url-bar',
    'navigation-controls-toggle',
    'navigation-state-changed',
    'refresh-state-changed',
    'tabs-changed',
    'theme-changed',
    'theme-colors-changed',
    'window-maximized-changed',
]);

contextBridge.exposeInMainWorld('headerAPI', {
    platform: process.platform,
    send: (channel: string, ...args: unknown[]) => {
        if (!SEND_CHANNELS.has(channel)) return;
        ipcRenderer.send(channel, ...args);
    },
    invoke: (channel: string, ...args: unknown[]) => {
        if (!INVOKE_CHANNELS.has(channel)) {
            return Promise.reject(new Error(`Blocked IPC invoke channel: ${channel}`));
        }
        return ipcRenderer.invoke(channel, ...args);
    },
    on: (channel: string, listener: (...args: unknown[]) => void) => {
        if (!ON_CHANNELS.has(channel) || typeof listener !== 'function') return;

        const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => listener(...args);
        ipcRenderer.on(channel, wrapped);
    },
});
