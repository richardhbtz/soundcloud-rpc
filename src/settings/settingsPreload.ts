import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const SEND_CHANNELS = new Set(['apply-changes', 'setting-changed', 'show-plugin-homepage-dialog', 'toggle-settings']);

const INVOKE_CHANNELS = new Set([
    'apply-custom-theme',
    'get-current-custom-theme',
    'get-custom-themes',
    'get-plugins',
    'get-plugins-folder-path',
    'get-themes-folder-path',
    'get-translations',
    'open-external-url',
    'open-path',
    'refresh-custom-themes',
    'refresh-plugins',
    'set-plugin-enabled',
]);

const ON_CHANNELS = new Set(['presence-preview-update', 'theme-changed', 'update-translations']);

function isHttpsUrl(value: string): boolean {
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

contextBridge.exposeInMainWorld('settingsAPI', {
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
    openExternal: (url: string) => {
        if (!isHttpsUrl(url)) return Promise.resolve('');
        return ipcRenderer.invoke('open-external-url', url);
    },
    openPath: (targetPath: string) => {
        if (typeof targetPath !== 'string' || !targetPath) return Promise.resolve('Invalid path');
        return ipcRenderer.invoke('open-path', targetPath);
    },
});
