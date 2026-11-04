import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');

// SoundCloud's device verification rejects authenticated writes (like, follow)
// when the request metadata contradicts the engine. Keep the wrapper out of
// Chromium's request construction.
describe('browser networking policy', () => {
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
});
