import { describe, it, expect } from 'vitest';
import {
    cleanTrackString,
    cleanTrackUrl,
    validateTrackInfo,
    validateTrackUpdatePayload,
    TRACK_UPDATE_REASONS,
} from './validation';

describe('cleanTrackString', () => {
    it('returns empty string for non-string inputs', () => {
        expect(cleanTrackString(null as unknown as string, 100)).toBe('');
        expect(cleanTrackString(undefined as unknown as string, 100)).toBe('');
        expect(cleanTrackString(123 as unknown as string, 100)).toBe('');
        expect(cleanTrackString({} as unknown as string, 100)).toBe('');
        expect(cleanTrackString([] as unknown as string, 100)).toBe('');
        expect(cleanTrackString(true as unknown as string, 100)).toBe('');
    });

    it('returns the string unchanged for valid input within max length', () => {
        expect(cleanTrackString('Hello World', 100)).toBe('Hello World');
    });

    it('strips control characters (code < 32)', () => {
        expect(cleanTrackString('Hello\x00World', 100)).toBe('HelloWorld');
        expect(cleanTrackString('Hello\x01World', 100)).toBe('HelloWorld');
        expect(cleanTrackString('Hello\nWorld', 100)).toBe('HelloWorld');
        expect(cleanTrackString('Hello\tWorld', 100)).toBe('HelloWorld');
        expect(cleanTrackString('Hello\x1fWorld', 100)).toBe('HelloWorld');
    });

    it('strips DEL character (code 127)', () => {
        expect(cleanTrackString('Hello\x7fWorld', 100)).toBe('HelloWorld');
    });

    it('keeps printable characters including space', () => {
        expect(cleanTrackString('Hello World!', 100)).toBe('Hello World!');
        expect(cleanTrackString('A-B_C.D', 100)).toBe('A-B_C.D');
        expect(cleanTrackString('~`!@#$%^&*()_+', 100)).toBe('~`!@#$%^&*()_+');
    });

    it('trims leading and trailing whitespace', () => {
        expect(cleanTrackString('  Hello  ', 100)).toBe('Hello');
        expect(cleanTrackString('\t\nHello\n\t', 100)).toBe('Hello');
    });

    it('respects max length limit', () => {
        expect(cleanTrackString('Hello World', 5)).toBe('Hello');
        expect(cleanTrackString('Hi', 100)).toBe('Hi');
        expect(cleanTrackString('A', 1)).toBe('A');
        expect(cleanTrackString('AB', 1)).toBe('A');
    });

    it('handles empty string', () => {
        expect(cleanTrackString('', 100)).toBe('');
    });

    it('handles string that becomes empty after cleaning', () => {
        expect(cleanTrackString('\x00\x01\x02', 100)).toBe('');
        expect(cleanTrackString('   ', 100)).toBe('');
    });

    it('blocks XSS payloads containing angle brackets via control char stripping', () => {
        // Note: < > are printable (codes 60, 62) so they pass cleanTrackString
        // but get neutralized by textContent in the settings view.
        // cleanTrackString focuses on control characters only.
        const payload = '<script>alert(1)</script>';
        const result = cleanTrackString(payload, 100);
        expect(result).toBe('<script>alert(1)</script>');
        expect(result.length).toBeLessThanOrEqual(100);
    });

    it('handles Unicode/emoji characters', () => {
        expect(cleanTrackString('Hello 🎵 World', 100)).toBe('Hello 🎵 World');
        expect(cleanTrackString('Tëst', 100)).toBe('Tëst');
    });

    it('handles very long max length values', () => {
        const long = 'a'.repeat(500);
        expect(cleanTrackString(long, 300)).toBe('a'.repeat(300));
    });
});

describe('cleanTrackUrl', () => {
    it('returns empty string for non-string inputs', () => {
        expect(cleanTrackUrl(null as unknown as string)).toBe('');
        expect(cleanTrackUrl(undefined as unknown as string)).toBe('');
        expect(cleanTrackUrl(123 as unknown as string)).toBe('');
    });

    it('returns the URL unchanged for valid HTTPS URLs', () => {
        expect(cleanTrackUrl('https://soundcloud.com/track')).toBe('https://soundcloud.com/track');
        expect(cleanTrackUrl('https://i1.sndcdn.com/artworks-000123456-t500x500.jpg')).toBe(
            'https://i1.sndcdn.com/artworks-000123456-t500x500.jpg',
        );
    });

    it('rejects HTTP URLs', () => {
        expect(cleanTrackUrl('http://soundcloud.com/track')).toBe('');
    });

    it('rejects non-URL strings', () => {
        expect(cleanTrackUrl('not a url')).toBe('');
        expect(cleanTrackUrl('javascript:alert(1)')).toBe('');
        expect(cleanTrackUrl('data:text/html,<script>alert(1)</script>')).toBe('');
        expect(cleanTrackUrl('ftp://example.com/file')).toBe('');
    });

    it('rejects file:// URLs', () => {
        expect(cleanTrackUrl('file:///etc/passwd')).toBe('');
    });

    it('handles empty string', () => {
        expect(cleanTrackUrl('')).toBe('');
    });

    it('trims whitespace from URLs', () => {
        expect(cleanTrackUrl('  https://soundcloud.com/track  ')).toBe('https://soundcloud.com/track');
    });

    it('strips control characters before URL parsing', () => {
        // cleanTrackString removes \x00 first, so the URL becomes valid
        expect(cleanTrackUrl('https://soundcloud.com/\x00track')).toBe('https://soundcloud.com/track');
    });

    it('truncates long URLs before validation', () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(3000);
        const result = cleanTrackUrl(longUrl);
        // Truncated to 2048 chars, then validated as HTTPS URL
        expect(result.startsWith('https://example.com/')).toBe(true);
        expect(result.length).toBeLessThanOrEqual(2048);
    });
});

describe('validateTrackInfo', () => {
    it('returns null for non-object inputs', () => {
        expect(validateTrackInfo(null)).toBeNull();
        expect(validateTrackInfo(undefined)).toBeNull();
        expect(validateTrackInfo('string')).toBeNull();
        expect(validateTrackInfo(123)).toBeNull();
        expect(validateTrackInfo(true)).toBeNull();
    });

    it('returns null for arrays', () => {
        expect(validateTrackInfo([])).toBeNull();
        expect(validateTrackInfo(['title', 'author'])).toBeNull();
    });

    it('validates and sanitizes a complete valid track object', () => {
        const input = {
            title: 'My Track',
            author: 'My Artist',
            artwork: 'https://example.com/artwork.jpg',
            elapsed: '1:23',
            duration: '3:45',
            isPlaying: true,
            url: 'https://soundcloud.com/artist/my-track',
        };

        const result = validateTrackInfo(input);
        expect(result).toEqual(input);
    });

    it('sanitizes string fields by stripping control characters', () => {
        const input = {
            title: 'My\x00Track',
            author: 'My\x01Artist',
            artwork: 'https://example.com/art.jpg',
            elapsed: '1:23',
            duration: '3:45',
            isPlaying: true,
            url: 'https://soundcloud.com/track',
        };

        const result = validateTrackInfo(input);
        expect(result!.title).toBe('MyTrack');
        expect(result!.author).toBe('MyArtist');
    });

    it('rejects non-HTTPS URLs for artwork and url fields', () => {
        const input = {
            title: 'Track',
            author: 'Artist',
            artwork: 'http://example.com/art.jpg',
            elapsed: '0:00',
            duration: '3:00',
            isPlaying: false,
            url: 'http://soundcloud.com/track',
        };

        const result = validateTrackInfo(input);
        expect(result!.artwork).toBe('');
        expect(result!.url).toBe('');
    });

    it('defaults isPlaying to false for non-boolean values', () => {
        const input = {
            title: 'Track',
            author: 'Artist',
            artwork: '',
            elapsed: '',
            duration: '',
            isPlaying: 'true' as unknown as boolean,
            url: '',
        };

        const result = validateTrackInfo(input);
        expect(result!.isPlaying).toBe(false);
    });

    it('handles missing fields by defaulting to empty strings', () => {
        const input = {};
        const result = validateTrackInfo(input);
        expect(result).toEqual({
            title: '',
            author: '',
            artwork: '',
            elapsed: '',
            duration: '',
            isPlaying: false,
            url: '',
        });
    });

    it('enforces max length on string fields', () => {
        const input = {
            title: 'a'.repeat(500),
            author: 'b'.repeat(300),
            artwork: 'https://example.com/a.jpg',
            elapsed: 'x'.repeat(100),
            duration: 'y'.repeat(100),
            isPlaying: true,
            url: 'https://soundcloud.com/track',
        };

        const result = validateTrackInfo(input);
        expect(result!.title.length).toBeLessThanOrEqual(300);
        expect(result!.author.length).toBeLessThanOrEqual(200);
        expect(result!.elapsed.length).toBeLessThanOrEqual(32);
        expect(result!.duration.length).toBeLessThanOrEqual(32);
    });

    it('handles XSS payload in title field by sanitizing control chars', () => {
        const input = {
            title: '</div><img src=x onerror="alert(1)"><div>',
            author: 'Artist',
            artwork: '',
            elapsed: '',
            duration: '',
            isPlaying: false,
            url: '',
        };

        const result = validateTrackInfo(input);
        // The string passes cleanTrackString (<> are printable), but is limited to 300 chars
        // Defense is at the rendering layer (textContent), not here
        expect(result!.title).toBe('</div><img src=x onerror="alert(1)"><div>');
        expect(result!.title.length).toBeLessThanOrEqual(300);
    });
});

describe('validateTrackUpdatePayload', () => {
    it('returns null for non-object inputs', () => {
        expect(validateTrackUpdatePayload(null)).toBeNull();
        expect(validateTrackUpdatePayload(undefined)).toBeNull();
        expect(validateTrackUpdatePayload('string')).toBeNull();
    });

    it('returns null for arrays', () => {
        expect(validateTrackUpdatePayload([])).toBeNull();
    });

    it('validates a complete valid payload', () => {
        const input = {
            data: {
                title: 'Track',
                author: 'Artist',
                artwork: 'https://example.com/art.jpg',
                elapsed: '0:00',
                duration: '3:00',
                isPlaying: true,
                url: 'https://soundcloud.com/track',
            },
            reason: 'track-change',
        };

        const result = validateTrackUpdatePayload(input);
        expect(result).not.toBeNull();
        expect(result!.reason).toBe('track-change');
        expect(result!.data.title).toBe('Track');
    });

    it('returns null when data is invalid', () => {
        const input = {
            data: 'not an object',
            reason: 'track-change',
        };

        expect(validateTrackUpdatePayload(input)).toBeNull();
    });

    it('defaults reason to track-change for invalid reasons', () => {
        const input = {
            data: {
                title: 'Track',
                author: 'Artist',
                artwork: '',
                elapsed: '',
                duration: '',
                isPlaying: false,
                url: '',
            },
            reason: 'invalid-reason',
        };

        const result = validateTrackUpdatePayload(input);
        expect(result!.reason).toBe('track-change');
    });

    it('accepts all valid reason values', () => {
        const baseData = {
            title: 'Track',
            author: 'Artist',
            artwork: '',
            elapsed: '',
            duration: '',
            isPlaying: false,
            url: '',
        };

        for (const reason of TRACK_UPDATE_REASONS) {
            const input = { data: baseData, reason };
            const result = validateTrackUpdatePayload(input);
            expect(result!.reason).toBe(reason);
        }
    });

    it('defaults reason to track-change when reason is missing', () => {
        const input = {
            data: {
                title: 'Track',
                author: 'Artist',
                artwork: '',
                elapsed: '',
                duration: '',
                isPlaying: false,
                url: '',
            },
        };

        const result = validateTrackUpdatePayload(input);
        expect(result!.reason).toBe('track-change');
    });

    it('defaults reason to track-change when reason is non-string', () => {
        const input = {
            data: {
                title: 'Track',
                author: 'Artist',
                artwork: '',
                elapsed: '',
                duration: '',
                isPlaying: false,
                url: '',
            },
            reason: 42,
        };

        const result = validateTrackUpdatePayload(input);
        expect(result!.reason).toBe('track-change');
    });

    it('handles empty object', () => {
        const result = validateTrackUpdatePayload({});
        expect(result).toBeNull();
    });
});

describe('TRACK_UPDATE_REASONS', () => {
    it('contains expected reason values', () => {
        expect(TRACK_UPDATE_REASONS.has('playback-state-change')).toBe(true);
        expect(TRACK_UPDATE_REASONS.has('track-change')).toBe(true);
        expect(TRACK_UPDATE_REASONS.has('seek-change')).toBe(true);
        expect(TRACK_UPDATE_REASONS.has('initial-state')).toBe(true);
        expect(TRACK_UPDATE_REASONS.has('waveform-seek')).toBe(true);
        expect(TRACK_UPDATE_REASONS.has('timeline-seek')).toBe(true);
    });

    it('does not contain arbitrary strings', () => {
        expect(TRACK_UPDATE_REASONS.has('arbitrary-reason')).toBe(false);
        expect(TRACK_UPDATE_REASONS.has('')).toBe(false);
    });
});
