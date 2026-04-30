import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('homepageConfirmAPI', {
    submit: (requestId: string, result: boolean) => {
        if (typeof requestId !== 'string' || typeof result !== 'boolean') return;
        ipcRenderer.send('homepage-confirm-result', { requestId, result });
    },
});

