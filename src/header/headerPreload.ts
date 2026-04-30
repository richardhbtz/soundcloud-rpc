import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const SEND_CHANNELS = new Set([
    'cancel-refresh',
    'close-window',
    'maximize-window',
    'minimize-window',
    'navigate-back',
    'navigate-forward',
    'refresh-page',
    'title-bar-double-click',
]);

const INVOKE_CHANNELS = new Set(['get-navigation-controls-enabled', 'get-theme-colors', 'is-maximized']);

const ON_CHANNELS = new Set([
    'navigation-controls-toggle',
    'navigation-state-changed',
    'refresh-state-changed',
    'theme-changed',
    'theme-colors-changed',
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