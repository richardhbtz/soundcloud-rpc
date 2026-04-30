import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('notificationAPI', {
    done: () => ipcRenderer.send('notification-done'),
});