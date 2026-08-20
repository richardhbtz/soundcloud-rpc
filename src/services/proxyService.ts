import type { Session } from 'electron';
import type ElectronStore = require('electron-store');
import { readSecret } from '../utils/secretStore';

interface ProxyData {
    user: string;
    password: string;
}

export class ProxyService {
    /**
     * Resolved lazily rather than captured at construction. The proxy has to be set on
     * the session that actually loads soundcloud.com -- the content view's -- and that
     * view is built after this service, then rebuilt with a different partition
     * (`persist:sc_<accountId>`) whenever the user switches account. Binding to
     * mainWindow's session instead, as this previously did, left the proxy applied to a
     * session nothing loads through on any non-default account.
     */
    private resolveSession: () => Session | null;
    private store: ElectronStore;
    private onNotification: (message: string) => void;

    constructor(resolveSession: () => Session | null, store: ElectronStore, notifyCallback: (message: string) => void) {
        this.resolveSession = resolveSession;
        this.store = store;
        this.onNotification = notifyCallback;
    }

    async apply(): Promise<void> {
        const session = this.resolveSession();
        if (!session) return;

        const proxyEnabled = this.store.get('proxyEnabled');
        const proxyHost = this.store.get('proxyHost');
        const proxyPort = this.store.get('proxyPort');

        if (proxyEnabled && proxyHost && proxyPort) {
            try {
                await session.setProxy({
                    proxyRules: `http://${proxyHost}:${proxyPort}`,
                });
                console.log(`Proxy enabled: http://${proxyHost}:${proxyPort}`);
            } catch (err) {
                console.error('Failed to set proxy:', err);
                this.onNotification('Failed to set proxy. Check your settings.');
            }
        } else {
            await session.setProxy({ mode: 'direct' });
        }
    }

    handleAuth(_: Electron.AuthInfo): { username: string; password: string } {
        if (!this.store.get('proxyEnabled')) {
            return { username: '', password: '' };
        }
        const proxyData = readSecret<ProxyData | undefined>(this.store, 'proxyData', undefined);
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
