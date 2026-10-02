import { describe, expect, it } from 'vitest';
import { EMPTY_PAGE_INFO, displayUrl, moveItem, parsePageInfo, resolveUrlInput, tabIcon, tabTitle } from './utils/tabs';

const info = (partial: Partial<typeof EMPTY_PAGE_INFO>) => ({ ...EMPTY_PAGE_INFO, ...partial });

describe('displayUrl', () => {
    it('drops the https://soundcloud.com/ prefix', () => {
        expect(displayUrl('https://soundcloud.com/discover')).toBe('discover');
        expect(displayUrl('https://soundcloud.com/offset-sc/sets/album?si=1')).toBe('offset-sc/sets/album?si=1');
        expect(displayUrl('https://soundcloud.com/')).toBe('');
    });

    it('shows other sites in full and a blank tab as empty', () => {
        expect(displayUrl('https://www.last.fm/api/auth')).toBe('https://www.last.fm/api/auth');
        expect(displayUrl('https://soundcloud.com.evil.example/x')).toBe('https://soundcloud.com.evil.example/x');
        expect(displayUrl('about:blank')).toBe('');
    });
});

describe('resolveUrlInput', () => {
    it('treats bare input as a path on soundcloud.com', () => {
        expect(resolveUrlInput('feed')).toBe('https://soundcloud.com/feed');
        expect(resolveUrlInput(' /you/library ')).toBe('https://soundcloud.com/you/library');
        expect(resolveUrlInput('soundcloud.com/offset-sc')).toBe('https://soundcloud.com/offset-sc');
    });

    it('accepts full SoundCloud URLs and refuses everything else', () => {
        expect(resolveUrlInput('https://soundcloud.com/upload')).toBe('https://soundcloud.com/upload');
        expect(resolveUrlInput('https://example.com/')).toBeNull();
        expect(resolveUrlInput('http://soundcloud.com/upload')).toBeNull();
        expect(resolveUrlInput('javascript://soundcloud.com/%0aalert(1)')).toBeNull();
        expect(resolveUrlInput('   ')).toBeNull();
    });

    it('searches for input that is not a path', () => {
        expect(resolveUrlInput('four tet & burial')).toBe('https://soundcloud.com/search?q=four%20tet%20%26%20burial');
    });
});

describe('tabTitle', () => {
    it('names a song "uploader - song title"', () => {
        const page = info({ title: 'Something I Need', user: 'Offset' });
        expect(tabTitle('https://soundcloud.com/offset-sc/something-i-need', page)).toBe('Offset - Something I Need');
    });

    it('names a playlist "playlist name - author"', () => {
        const page = info({ title: 'All music genres', user: 'Music Charts' });
        expect(tabTitle('https://soundcloud.com/music-charts-us/sets/all-music-genres', page)).toBe(
            'All music genres - Music Charts',
        );
    });

    it('names profiles after their owner, and your own "Profile"', () => {
        const page = info({ profile: 'Offset', ownProfilePath: '/me' });
        expect(tabTitle('https://soundcloud.com/offset-sc/tracks', page)).toBe('Offset');
        expect(tabTitle('https://soundcloud.com/me', info({ profile: 'Me', ownProfilePath: '/me' }))).toBe('Profile');
    });

    it('names SoundCloud pages from their path', () => {
        expect(tabTitle('https://soundcloud.com/discover', EMPTY_PAGE_INFO)).toBe('Home');
        expect(tabTitle('https://soundcloud.com/feed', EMPTY_PAGE_INFO)).toBe('Feed');
        expect(tabTitle('https://soundcloud.com/upload', EMPTY_PAGE_INFO)).toBe('Upload');
        expect(tabTitle('https://soundcloud.com/you/library', EMPTY_PAGE_INFO)).toBe('Library');
        expect(tabTitle('https://soundcloud.com/search/sounds?q=x', EMPTY_PAGE_INFO)).toBe('Search');
        expect(tabTitle('https://soundcloud.com/terms-of-use', EMPTY_PAGE_INFO)).toBe('Terms of use');
    });

    it('falls back to the host off SoundCloud and "New Tab" before anything loads', () => {
        expect(tabTitle('https://www.last.fm/api/auth', EMPTY_PAGE_INFO)).toBe('www.last.fm');
        expect(tabTitle('about:blank', EMPTY_PAGE_INFO)).toBe('New Tab');
        expect(tabTitle('', EMPTY_PAGE_INFO)).toBe('New Tab');
    });
});

describe('parsePageInfo', () => {
    it('accepts the preload payload and ignores extra fields', () => {
        const payload = { title: 'a', user: 'b', profile: '', ownProfilePath: '/me', artwork: '' };
        expect(parsePageInfo({ ...payload, extra: 1 })).toEqual(payload);
    });

    it('rejects anything malformed', () => {
        expect(parsePageInfo(null)).toBeNull();
        expect(parsePageInfo({ title: 'a' })).toBeNull();
        expect(parsePageInfo({ ...EMPTY_PAGE_INFO, title: 1 })).toBeNull();
        expect(parsePageInfo({ ...EMPTY_PAGE_INFO, title: 'x'.repeat(301) })).toBeNull();
    });
});

describe('tabIcon', () => {
    const art = 'https://i1.sndcdn.com/artworks-UDucSFVAERf5-0-t1080x1080.jpg';

    it('uses the cover or profile picture at thumbnail size', () => {
        expect(tabIcon(info({ title: 'Song', artwork: art }))).toBe(
            'https://i1.sndcdn.com/artworks-UDucSFVAERf5-0-t120x120.jpg',
        );
        expect(tabIcon(info({ profile: 'Offset', artwork: art }))).toContain('-t120x120.jpg');
    });

    it('is empty for SoundCloud pages, so they get the SoundCloud icon', () => {
        expect(tabIcon(info({ artwork: art }))).toBe('');
        expect(tabIcon(info({ title: 'Song' }))).toBe('');
    });

    it('only accepts images from the SoundCloud CDN', () => {
        expect(tabIcon(info({ title: 'Song', artwork: 'https://evil.example/x.jpg' }))).toBe('');
        expect(tabIcon(info({ title: 'Song', artwork: 'http://i1.sndcdn.com/x.jpg' }))).toBe('');
        expect(tabIcon(info({ title: 'Song', artwork: 'javascript:alert(1)' }))).toBe('');
    });
});

describe('moveItem', () => {
    it('moves a tab to the slot it was dropped on', () => {
        expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
        expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    });

    it('ignores positions that do not exist', () => {
        expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
        expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
    });
});
