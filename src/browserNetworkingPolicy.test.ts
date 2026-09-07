import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');
const settingsSource = readFileSync(resolve(process.cwd(), 'src/settings/settingsManager.ts'), 'utf8');

describe('SoundCloud browser networking policy', () => {
    it.each([
        ['per-view user agent override', /\.setUserAgent\s*\(/],
        ['global user agent fallback', /userAgentFallback\s*=/],
        ['manual User-Agent header', /['"]User-Agent['"]\s*:/i],
        ['manual client hints', /['"]sec-ch-ua(?:-mobile|-platform)?['"]\s*:/i],
        ['manual Fetch Metadata', /['"]Sec-Fetch-(?:Site|Mode|User|Dest)['"]\s*:/i],
        ['request header interceptor', /webRequest\.onBeforeSendHeaders\s*\(/],
    ])('does not contain a %s', (_description, pattern) => {
        expect(mainSource).not.toMatch(pattern);
    });

    it('keeps the remote SoundCloud renderer sandboxed', () => {
        expect(mainSource).not.toMatch(/sandbox\s*:\s*false/);
    });

    it('cannot enable Ghostery in the validation build', () => {
        expect(mainSource).not.toMatch(/ElectronBlocker|enableBlockingInSession/);
        expect(settingsSource).toMatch(/id="adBlocker"[^>]*disabled/);
    });
});
