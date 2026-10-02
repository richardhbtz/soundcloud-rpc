import { describe, expect, it } from 'vitest';
import { chromeBrandList, deriveBrowserUserAgent } from './utils/userAgent';

// Electron's documented default shape: real Chromium UA + app token + Electron token
const ELECTRON_UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) SoundCloud/0.2.0 Chrome/140.0.7339.207 Electron/41.10.3 Safari/537.36';

describe('deriveBrowserUserAgent', () => {
    it('removes the app and Electron product tokens and reduces the Chrome version like Chrome does', () => {
        expect(deriveBrowserUserAgent(ELECTRON_UA, 'SoundCloud')).toBe(
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        );
    });

    it('keeps the real platform and Chrome major version, so client hints stay consistent', () => {
        const ua = deriveBrowserUserAgent(ELECTRON_UA, 'SoundCloud');
        expect(ua).toContain('X11; Linux x86_64');
        expect(ua).toContain('Chrome/140.0.0.0');
        expect(ua).not.toContain('Electron/');
        expect(ua).not.toContain('SoundCloud/');
    });

    it('handles the dev-mode app name, which differs from productName', () => {
        const dev = ELECTRON_UA.replace('SoundCloud/0.2.0', 'soundcloud-rpc/0.2.0');
        expect(deriveBrowserUserAgent(dev, 'soundcloud-rpc')).not.toContain('soundcloud-rpc/');
    });

    it('is a no-op on a UA that has no tokens to strip', () => {
        const plain =
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
        expect(deriveBrowserUserAgent(plain, 'SoundCloud')).toBe(plain);
    });

    it('does not let a regex-special app name break the pattern', () => {
        const ua = 'Mozilla/5.0 (X11) AppleWebKit/537.36 My.App+/1.0 Chrome/140.0.0.0 Electron/41.0.0 Safari/537.36';
        expect(deriveBrowserUserAgent(ua, 'My.App+')).toBe(
            'Mozilla/5.0 (X11) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
        );
    });
});

// expected values are Sec-CH-UA headers as sent by real Google Chrome builds of those versions
describe('chromeBrandList', () => {
    const header = (version: string) =>
        chromeBrandList(version, false)
            .map((b) => `"${b.brand}";v="${b.version}"`)
            .join(', ');

    it('matches the brand list real Chrome sends', () => {
        expect(header('131.0.6778.86')).toBe('"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"');
        expect(header('124.0.6367.61')).toBe('"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"');
    });

    it('uses full versions for the full version list', () => {
        expect(chromeBrandList('131.0.6778.86', true)).toEqual([
            { brand: 'Google Chrome', version: '131.0.6778.86' },
            { brand: 'Chromium', version: '131.0.6778.86' },
            { brand: 'Not_A Brand', version: '24.0.0.0' },
        ]);
    });
});
