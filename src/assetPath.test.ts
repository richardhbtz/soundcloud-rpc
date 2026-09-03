import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { resolveAssetPath } from './utils/assetPath';

const ROOT = join('/app', 'tsc');
const HOST_DIR = join(ROOT, 'settings');

describe('resolveAssetPath', () => {
    it('resolves a normal asset inside the view directory', () => {
        expect(resolveAssetPath(ROOT, 'settings', '/settingsPanel.js')).toBe(join(HOST_DIR, 'settingsPanel.js'));
    });

    it('never escapes the view directory via traversal', () => {
        for (const attempt of [
            '/../../../etc/passwd',
            '/../main.js',
            '/foo/../../../main.js',
            '/....//....//main.js',
        ]) {
            const resolved = resolveAssetPath(ROOT, 'settings', attempt);
            if (resolved !== null) expect(resolved.startsWith(HOST_DIR)).toBe(true);
        }
    });

    it('resists percent-encoded traversal', () => {
        const resolved = resolveAssetPath(ROOT, 'settings', '/..%2f..%2fmain.js');
        if (resolved !== null) expect(resolved.startsWith(HOST_DIR)).toBe(true);
    });

    it('returns null for malformed percent-encoding rather than throwing', () => {
        expect(resolveAssetPath(ROOT, 'settings', '/%E0%A4%A')).toBeNull();
    });

    it('keeps each view in its own directory', () => {
        const resolved = resolveAssetPath(ROOT, 'confirm', '/confirmPanel.js');
        expect(resolved?.startsWith(join(ROOT, 'confirm'))).toBe(true);
        expect(resolved?.startsWith(HOST_DIR)).toBe(false);
    });
});
