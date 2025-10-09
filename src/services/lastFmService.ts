import { BrowserView } from 'electron';
import type ElectronStore = require('electron-store');
import * as crypto from 'crypto';
import fetch from 'cross-fetch';
import { normalizeTrackInfo } from '../utils/trackParser';
import type { LastFmTrackData } from '../types';

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
        const isNegative = timeStr.trim().startsWith('-');
        const raw = isNegative ? timeStr.trim().slice(1) : timeStr.trim();
        const parts = raw.split(':').map((p) => Number(p));
        let seconds = 0;
        for (const part of parts) {
            seconds = seconds * 60 + (isNaN(part) ? 0 : part);
        }
        // Use absolute value for track duration
        return Math.max(1, Math.abs(seconds));
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

export class LastFmService {
    private window: BrowserView;
    private store: ElectronStore;
    private currentScrobbleState: ScrobbleState | null = null;

    constructor(window: BrowserView, store: ElectronStore) {
        this.window = window;
        this.store = store;

        // Initialize Last.fm state from store
        const apikey = this.store.get('lastFmApiKey');
        const secret = this.store.get('lastFmSecret');
        if (apikey && secret) {
            this.store.set('lastFmEnabled', true);
        }
    }

    private async getLastFmSession(api_key: string, token: string) {
        const lastFmSecret = this.store.get('lastFmSecret');
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
        this.store.set('lastFmSessionKey', data.session.key); // Store the session key
    }

    public async authenticate(): Promise<void> {
        const apikey = this.store.get('lastFmApiKey');
        const secret = this.store.get('lastFmSecret');
        const enabled = this.store.get('lastFmEnabled');
        const lastFmSessionKey = this.store.get('lastFmSessionKey');

        if (!enabled || !apikey || !secret || !this.window.webContents.getURL().startsWith('https://soundcloud.com/')) {
            return;
        }

        if (lastFmSessionKey) {
            return; // Already authenticated
        }

        const authUrl = `https://www.last.fm/api/auth/?api_key=${apikey}&cb=https://soundcloud.com/discover`;

        await this.window.webContents.loadURL(authUrl);

        this.window.webContents.on('will-redirect', async (_, url) => {
            try {
                const urlObj = new URL(url);
                const token = urlObj.searchParams.get('token');
                if (token) {
                    await this.getLastFmSession(apikey as string, token as string);
                    this.window.webContents.loadURL('https://soundcloud.com/discover');
                }
            } catch (error) {
                console.error('Error during Last.fm authentication', error);
            }
        });
    }

    private async scrobbleTrack(trackInfo: { author: string; title: string }): Promise<void> {
        const sessionKey = this.store.get('lastFmSessionKey');
        if (!sessionKey) {
            console.error('No Last.fm session key found');
            return;
        }
        const apiKey = this.store.get('lastFmApiKey') as string;
        const secretKey = this.store.get('lastFmSecret') as string;
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

    private async updateNowPlaying(trackInfo: { author: string; title: string }): Promise<void> {
        const sessionKey = this.store.get('lastFmSessionKey');
        if (!sessionKey) {
            return;
        }
        const apiKey = this.store.get('lastFmApiKey') as string;
        const secretKey = this.store.get('lastFmSecret') as string;
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

    public async updateTrackInfo(trackInfo: LastFmTrackData): Promise<void> {
        if (!this.store.get('lastFmEnabled')) return;

        if (!trackInfo.title || !trackInfo.author) {
            console.log('Incomplete track info:', trackInfo);
            return;
        }

        const normalizedTrack = normalizeTrackInfo(
            trackInfo.title,
            trackInfo.author,
            this.store.get('trackParserEnabled', true) as boolean,
        );
        const currentTrack = {
            author: normalizedTrack.artist,
            title: normalizedTrack.track,
        };

        await this.updateNowPlaying(currentTrack);

        if (
            !this.currentScrobbleState ||
            this.currentScrobbleState.artist !== currentTrack.author ||
            this.currentScrobbleState.title !== currentTrack.title ||
            trackInfo.elapsed === '0:00'
        ) {
            // Scrobble previous track if it wasn't scrobbled and met criteria
            if (
                this.currentScrobbleState &&
                !this.currentScrobbleState.scrobbled &&
                shouldScrobble(this.currentScrobbleState)
            ) {
                await this.scrobbleTrack({
                    author: this.currentScrobbleState.artist,
                    title: this.currentScrobbleState.title,
                });
            }

            // Start tracking new track
            this.currentScrobbleState = {
                artist: currentTrack.author,
                title: currentTrack.title,
                startTime: Date.now(),
                duration: timeStringToSeconds(trackInfo.duration),
                scrobbled: false,
            };
        } else if (
            this.currentScrobbleState &&
            !this.currentScrobbleState.scrobbled &&
            shouldScrobble(this.currentScrobbleState)
        ) {
            // Scrobble current track if it meets criteria
            await this.scrobbleTrack({
                author: this.currentScrobbleState.artist,
                title: this.currentScrobbleState.title,
            });
            this.currentScrobbleState.scrobbled = true;
        }
    }

    public disconnect(): void {
        this.store.set('lastFmEnabled', false);
        this.store.delete('lastFmApiKey');
        this.store.delete('lastFmSecret');
        this.store.delete('lastFmSessionKey');
        this.window.webContents.reload();
    }
}
