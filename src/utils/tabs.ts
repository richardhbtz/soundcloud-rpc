export const SOUNDCLOUD_ORIGIN = 'https://soundcloud.com';

/** What the page itself shows, as reported by preload.ts. Empty strings when absent. */
export interface PageInfo {
    /** track or playlist title from the page hero */
    title: string;
    /** uploader of that track or playlist */
    user: string;
    /** display name on a profile page */
    profile: string;
    /** path of the signed-in user's own profile, e.g. "/some-user" */
    ownProfilePath: string;
    /** cover of the track or playlist, or the profile picture */
    artwork: string;
}

export const EMPTY_PAGE_INFO: PageInfo = { title: '', user: '', profile: '', ownProfilePath: '', artwork: '' };

export function parsePageInfo(payload: unknown): PageInfo | null {
    if (typeof payload !== 'object' || payload === null) return null;

    const info = { ...EMPTY_PAGE_INFO };
    for (const key of Object.keys(info) as (keyof PageInfo)[]) {
        const value = (payload as Record<string, unknown>)[key];
        if (typeof value !== 'string' || value.length > 300) return null;
        info[key] = value;
    }
    return info;
}

function soundCloudPath(url: string): string | null {
    try {
        const parsed = new URL(url);
        return parsed.origin === SOUNDCLOUD_ORIGIN ? parsed.href.slice(SOUNDCLOUD_ORIGIN.length + 1) : null;
    } catch {
        return null;
    }
}

/** URL bar text while it is not focused: the address without the https://soundcloud.com/ prefix. */
export function displayUrl(url: string): string {
    if (url === 'about:blank') return '';
    return soundCloudPath(url) ?? url;
}

/** Turns URL bar input into a SoundCloud address, or null when it points anywhere else. */
export function resolveUrlInput(input: string): string | null {
    const text = input.trim();
    if (!text) return null;

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
        try {
            const url = new URL(text);
            const onSoundCloud = url.hostname === 'soundcloud.com' || url.hostname.endsWith('.soundcloud.com');
            return url.protocol === 'https:' && onSoundCloud ? url.href : null;
        } catch {
            return null;
        }
    }

    const path = text.replace(/^(www\.)?soundcloud\.com(\/|$)/i, '').replace(/^\/+/, '');
    if (/\s/.test(path)) return `${SOUNDCLOUD_ORIGIN}/search?q=${encodeURIComponent(path)}`;
    return `${SOUNDCLOUD_ORIGIN}/${path}`;
}

/**
 * Tab icon: the page's cover or profile picture at thumbnail size, or '' for pages without one
 * (those get the SoundCloud icon). Only SoundCloud's image CDN is accepted, since the URL is read
 * out of the page and ends up as an <img> in the header.
 */
export function tabIcon(info: PageInfo): string {
    if (!info.title && !info.profile) return '';
    try {
        const url = new URL(info.artwork);
        if (url.protocol !== 'https:' || !url.hostname.endsWith('.sndcdn.com')) return '';
        return url.href.replace(/-t\d+x\d+(\.\w+)$/, '-t120x120$1');
    } catch {
        return '';
    }
}

/** New position list after dragging the tab at `from` onto the slot at `to`. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
    if (from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
    const moved = [...items];
    moved.splice(to, 0, ...moved.splice(from, 1));
    return moved;
}

const pageName = (segment: string) => {
    const words = segment.replace(/-/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Tab label: "playlist name - author", "uploader - song title", or the name of the SoundCloud page.
 * A profile is named after its owner, except the signed-in user's own, which is "Profile" like
 * SoundCloud's own menu calls it.
 */
export function tabTitle(url: string, info: PageInfo): string {
    const path = soundCloudPath(url);
    if (path === null) {
        try {
            return new URL(url).hostname || 'New Tab';
        } catch {
            return 'New Tab';
        }
    }

    const segments = path.split(/[?#]/)[0].split('/').filter(Boolean);

    if (info.title) {
        if (!info.user) return info.title;
        // playlists read "name - author", songs "uploader - title"
        return segments.includes('sets') ? `${info.title} - ${info.user}` : `${info.user} - ${info.title}`;
    }
    if (info.profile) return info.ownProfilePath === `/${segments[0]}` ? 'Profile' : info.profile;

    if (segments.length === 0 || segments[0] === 'discover') return 'Home';
    if (segments[0] === 'you' && segments[1]) return pageName(segments[1]);
    return pageName(segments[0]);
}
