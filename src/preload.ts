import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld(
    'soundcloudAPI', 
    {
        sendTrackUpdate: (data: any, reason: string) => {
        ipcRenderer.send('soundcloud:track-update', {
            data,
            reason
        });
    }
  }
);
