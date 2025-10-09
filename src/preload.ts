import { contextBridge, ipcRenderer } from 'electron';
import type { TrackInfo, TrackUpdateReason } from './types';

contextBridge.exposeInMainWorld(
    'soundcloudAPI', 
    {
        sendTrackUpdate: (data: TrackInfo, reason: TrackUpdateReason) => {
            ipcRenderer.send('soundcloud:track-update', {
                data,
                reason
            });
        }
    }
);
