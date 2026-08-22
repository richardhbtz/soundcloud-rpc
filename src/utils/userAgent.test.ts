import { describe, it, expect } from 'vitest';
import { stripAppTokensFromUserAgent } from './userAgent';

const ELECTRON_DEFAULT =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) soundcloud-rpc/0.2.0 Chrome/140.0.7339.207 Electron/41.1.1 Safari/537.36';

const CHROME_EQUIVALENT =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.207 Safari/537.36';

describe('stripAppTokensFromUserAgent', () => {
    it('turns the Electron default into the equivalent Chrome user agent', () => {
        expect(stripAppTokensFromUserAgent(ELECTRON_DEFAULT, 'soundcloud-rpc')).toBe(CHROME_EQUIVALENT);
    });

    it('keeps the real platform and Chromium version instead of inventing them', () => {
        const stripped = stripAppTokensFromUserAgent(ELECTRON_DEFAULT, 'soundcloud-rpc');

        expect(stripped).toContain('X11; Linux x86_64');
        expect(stripped).toContain('Chrome/140.0.7339.207');
    });

    it('leaves no Electron or app fingerprint behind', () => {
        const stripped = stripAppTokensFromUserAgent(ELECTRON_DEFAULT, 'soundcloud-rpc');

        expect(stripped.toLowerCase()).not.toContain('electron');
        expect(stripped.toLowerCase()).not.toContain('soundcloud-rpc');
    });

    it('handles the macOS and Windows defaults the same way', () => {
        const mac =
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) soundcloud-rpc/0.2.0 Chrome/140.0.7339.207 Electron/41.1.1 Safari/537.36';
        const win =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) soundcloud-rpc/0.2.0 Chrome/140.0.7339.207 Electron/41.1.1 Safari/537.36';

        expect(stripAppTokensFromUserAgent(mac, 'soundcloud-rpc')).toBe(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.207 Safari/537.36',
        );
        expect(stripAppTokensFromUserAgent(win, 'soundcloud-rpc')).toBe(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.207 Safari/537.36',
        );
    });

    it('leaves a user agent that carries neither token untouched', () => {
        expect(stripAppTokensFromUserAgent(CHROME_EQUIVALENT, 'soundcloud-rpc')).toBe(CHROME_EQUIVALENT);
    });

    it('treats regex metacharacters in the app name literally', () => {
        const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) sound.cloud/1.0 Chrome/140.0.0.0 Safari/537.36';

        expect(stripAppTokensFromUserAgent(userAgent, 'sound.cloud')).toBe(
            'Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0.0.0 Safari/537.36',
        );
        expect(stripAppTokensFromUserAgent(userAgent, 'soundxcloud')).toBe(userAgent);
    });
});
