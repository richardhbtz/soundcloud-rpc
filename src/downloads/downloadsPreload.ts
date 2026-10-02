import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const SEND_CHANNELS = new Set([
    'downloads-cancel',
    'downloads-clear',
    'downloads-open-folder',
    'downloads-show',
    'toggle-downloads',
]);

contextBridge.exposeInMainWorld('downloadsAPI', {
    send: (channel: string, ...args: unknown[]) => {
        if (!SEND_CHANNELS.has(channel)) return;
        ipcRenderer.send(channel, ...args);
    },
    getDownloads: () => ipcRenderer.invoke('get-downloads'),
    onChanged: (listener: (items: unknown) => void) => {
        if (typeof listener !== 'function') return;
        ipcRenderer.on('downloads-changed', (_event: IpcRendererEvent, items: unknown) => listener(items));
    },
});
