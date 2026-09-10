import { describe, expect, it } from 'vitest';
import { extractThemeColors } from './utils/colorExtractor';

describe('extractThemeColors', () => {
    it('extracts hex colours from CSS variables', () => {
        const colors = extractThemeColors(':root { --primary-color: #ff5500; --background-color: #121212; }');
        expect(colors?.primary).toBe('#ff5500');
    });

    it('returns null for empty input', () => {
        expect(extractThemeColors('')).toBeNull();
        expect(extractThemeColors('   ')).toBeNull();
    });

    it('returns an identical result on a repeated call', () => {
        const css = ':root { --primary-color: #abcdef; --text-color: #ffffff; }';
        expect(extractThemeColors(css)).toEqual(extractThemeColors(css));
    });

    it('accepts well-formed rgb and hsl values', () => {
        expect(extractThemeColors(':root { --primary-color: rgb(255, 85, 0); }')?.primary).toBe('rgb(255, 85, 0)');
        expect(extractThemeColors(':root { --primary-color: hsl(20, 100%, 50%); }')?.primary).toBe(
            'hsl(20, 100%, 50%)',
        );
    });

    it('rejects a value with trailing content after the closing paren', () => {
        // a prefix-only test such as /^rgba?\(/ would have accepted this, letting the
        // trailing text through to whatever consumed the colour
        const colors = extractThemeColors(`:root { --primary-color: rgb(0,0,0)'); alert(1); //; }`);
        expect(colors?.primary).not.toContain('alert');
    });

    it('rejects a hex value with trailing content', () => {
        const colors = extractThemeColors(`:root { --primary-color: #fff" onload="x; }`);
        expect(colors?.primary).not.toContain('onload');
    });
});
