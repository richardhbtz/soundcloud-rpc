import type { BrowserWindow } from 'electron';

import * as crypto from 'crypto';
import fetch from 'cross-fetch';
import type ElectronStore = require('electron-store');

export interface ScrobbleState {
    artist: string;
    title: string;
    startTime: number;
    duration: number;
    scrobbled: boolean;
}

function timeStringToSeconds(timeStr: string | undefined): number {
    if (!timeStr || typeof timeStr !== 'string') return 240; // Default to 4 minutes if no duration
    try {
        const [minutes, seconds] = timeStr.split(':').map(Number);
        return minutes * 60 + (seconds || 0);
    } catch (error) {
        console.error('Error parsing time string:', error);
        return 240; // Default to 4 minutes on error
    }
}
function shouldScrobble(state: ScrobbleState): boolean {
    const playedTime = (Date.now() - state.startTime) / 1000;
    const halfDuration = state.duration / 2;

    return !state.scrobbled && playedTime >= Math.min(halfDuration, 240);
}

async function authenticateLastFm(mainWindow: BrowserWindow, store: ElectronStore): Promise<void> {
    const lastFmSessionKey = store.get('lastFmSessionKey');
    if (lastFmSessionKey) {
        return; // Already authenticated
    }

    const apiKey = store.get('lastFmApiKey') as string;
    if (!apiKey) {
        console.error('No Last.fm API key found');
        return;
    }

    const authUrl = `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=https://soundcloud.com/discover`;
    await mainWindow.loadURL(authUrl);

    mainWindow.webContents.on('will-redirect', async (_, url) => {
        try {
            const urlObj = new URL(url);
            const token = urlObj.searchParams.get('token');
            if (token) {
                await getLastFmSession(apiKey, token, store);
                mainWindow.loadURL('https://soundcloud.com/discover');
            }
        } catch (error) {
            console.error('Error during Last.fm authentication', error);
        }
    });
}

// After the user logs in, retrieve and store the session key
async function getLastFmSession(api_key: string, token: string, store: ElectronStore) {
    const lastFmSecret = store.get('lastFmSecret');
    const apiSig = generateApiSignature(
        {
            method: 'auth.getSession',
            api_key,
            token,
        },
        lastFmSecret as string,
    );

    const response = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${api_key}&token=${token}&api_sig=${apiSig}&format=json`,
    );
    const data = await response.json();
    if (data.error) {
        console.error(data.message);
        return;
    }
    store.set('lastFmSessionKey', data.session.key); // Store the session key
}

function generateApiSignature(
    params: {
        [x: string]: string | undefined;
        method?: string;
        api_key?: string;
        token?: string;
    },
    secret: string,
): string {
    const sortedParams =
        Object.keys(params)
            .sort()
            .map((key) => `${key}${params[key]}`)
            .join('') + secret;
    return crypto.createHash('md5').update(sortedParams, 'utf8').digest('hex');
}

async function scrobbleTrack(trackInfo: { author: string; title: string }, store: ElectronStore): Promise<void> {
    const sessionKey = store.get('lastFmSessionKey');
    if (!sessionKey) {
        console.error('No Last.fm session key found');
        return;
    }
    const apiKey = store.get('lastFmApiKey') as string;
    const secretKey = store.get('lastFmSecret') as string;
    if (!apiKey || !secretKey) {
        console.error('No Last.fm API key found');
        return;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
        method: 'track.scrobble',
        api_key: apiKey,
        sk: sessionKey as string,
        artist: trackInfo.author,
        track: trackInfo.title,
        timestamp: timestamp.toString(),
    };
    const apiSig = generateApiSignature(params, secretKey);
    try {
        const response = await fetch(`https://ws.audioscrobbler.com/2.0/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                ...params,
                api_sig: apiSig,
                format: 'json',
            }),
        });

        const data = await response.json();
        if (data.error) {
            console.error('Last.fm scrobble error', data.message);
        } else {
            console.log(`Track scrobbled on Last.fm ${trackInfo.author} - ${trackInfo.title}`);
        }
    } catch (error) {
        console.error('Failed to scrobble track:', error);
    }
}

const trackChanged = (current: any, previous: any): boolean => {
    if (!previous) return true;
    return current.artist !== previous.artist || current.title !== previous.title;
};

async function updateNowPlaying(trackInfo: { author: any; title: any }, store: ElectronStore): Promise<void> {
    const sessionKey = store.get('lastFmSessionKey');
    if (!sessionKey) {
        return;
    }
    const apiKey = store.get('lastFmApiKey') as string;
    const secretKey = store.get('lastFmSecret') as string;
    if (!apiKey || !secretKey) {
        console.error('No Last.fm API key found');
        return;
    }

    const params = {
        method: 'track.updateNowPlaying',
        api_key: apiKey,
        sk: sessionKey as string,
        artist: trackInfo.author,
        track: trackInfo.title,
    };

    const apiSig = generateApiSignature(params, secretKey);
    try {
        const response = await fetch(`https://ws.audioscrobbler.com/2.0/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                ...params,
                api_sig: apiSig,
                format: 'json',
            }),
        });

        const data = await response.json();
        if (data.error) {
            console.error('Last.fm now playing error', data.message);
            return;
        }
    } catch (e) {
        console.error('Failed to update now playing', e);
    }
}

export {
    authenticateLastFm,
    getLastFmSession,
    scrobbleTrack,
    updateNowPlaying,
    trackChanged,
    shouldScrobble,
    timeStringToSeconds,
    generateApiSignature,
};
