import { BrowserWindow } from 'electron';
import type ElectronStore = require('electron-store');

interface ProxyData {
    user: string;
    password: string;
}

export class ProxyService {
    private window: BrowserWindow;
    private store: ElectronStore;
    private onNotification: (message: string) => void;

    constructor(window: BrowserWindow, store: ElectronStore, notifyCallback: (message: string) => void) {
        this.window = window;
        this.store = store;
        this.onNotification = notifyCallback;
    }

    async apply(): Promise<void> {
        if (!this.window) return;
        const proxyEnabled = this.store.get('proxyEnabled');
        const proxyHost = this.store.get('proxyHost');
        const proxyPort = this.store.get('proxyPort');

        if (proxyEnabled && proxyHost && proxyPort) {
            try {
                await this.window.webContents.session.setProxy({
                    proxyRules: `http://${proxyHost}:${proxyPort}`,
                });
                console.log(`Proxy enabled: http://${proxyHost}:${proxyPort}`);
            } catch (err) {
                console.error('Failed to set proxy:', err);
                this.onNotification('Failed to set proxy. Check your settings.');
            }
        } else {
            await this.window.webContents.session.setProxy({ mode: 'direct' });
        }
    }

    handleAuth(_: Electron.AuthInfo): { username: string; password: string } {
        if (!this.store.get('proxyEnabled')) {
            return { username: '', password: '' };
        }
        const proxyData = this.store.get('proxyData') as ProxyData | undefined;
        return {
            username: proxyData?.user || '',
            password: proxyData?.password || '',
        };
    }

    transformKey(key: string): string {
        const keyMap: Record<string, string> = {
            proxyEnabled: 'proxyEnabled',
            proxyHost: 'proxyHost',
            proxyPort: 'proxyPort',
            proxyData: 'proxyData',
        };
        return keyMap[key] || key;
    }
}
