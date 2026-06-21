import { BrowserView } from 'electron';
import type ElectronStore from 'electron-store';
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
    isPaused: boolean;
    pausedTime: number;
    lastElapsedSeconds: number;
}

function timeStringToSeconds(timeStr: string | undefined): number {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    try {
        const clean = timeStr.trim().replace(/^-/, '');
        const parts = clean.split(':').map(Number);
        let seconds = 0;
        for (const part of parts) {
            seconds = seconds * 60 + (isNaN(part) ? 0 : part);
        }
        return Math.abs(seconds);
    } catch {
        return 0;
    }
}

function shouldScrobble(state: ScrobbleState): boolean {
    const totalPlayed = (Date.now() - state.startTime) / 1000 - state.pausedTime;
    return !state.scrobbled && totalPlayed >= Math.min(state.duration / 2, 240);
}

function generateApiSignature(params: Record<string, string>, secret: string): string {
    const sorted =
        Object.keys(params)
            .sort()
            .map((k) => `${k}${params[k]}`)
            .join('') + secret;
    return crypto.createHash('md5').update(sorted, 'utf8').digest('hex');
}

export class LastFmService {
    private isAuthenticating: boolean = false;
    private readonly window: BrowserView;
    private readonly store: ElectronStore;
    private currentScrobbleState: ScrobbleState | null = null;
    private pauseStartTime: number = 0;
    private loopWatchdog: NodeJS.Timeout | null = null;

    constructor(window: BrowserView, store: ElectronStore) {
        this.window = window;
        this.store = store;
    }

    /* API dispatcher eliminates duplicate fetch headers &&& signing logic */
    private async sendLastFmRequest(method: string, params: Record<string, string>): Promise<any> {
        const sessionKey = this.store.get('lastFmSessionKey') as string;
        const apiKey = this.store.get('lastFmApiKey') as string;
        const secretKey = this.store.get('lastFmSecret') as string;

        if (!sessionKey || !apiKey || !secretKey) return null;

        const payload = {
            method,
            api_key: apiKey,
            sk: sessionKey,
            ...params,
        };

        const apiSig = generateApiSignature(payload, secretKey);

        try {
            const response = await fetch('https://ws.audioscrobbler.com/2.0/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ ...payload, api_sig: apiSig, format: 'json' }),
            });
            return await response.json();
        } catch (error) {
            console.error(`Last.fm API [${method}] error:`, error);
            return null;
        }
    }

    private async getLastFmSession(api_key: string, token: string) {
        const secret = this.store.get('lastFmSecret') as string;
        const apiSig = generateApiSignature({ method: 'auth.getSession', api_key, token }, secret);

        const res = await fetch(
            `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${api_key}&token=${token}&api_sig=${apiSig}&format=json`,
        );
        const data = await res.json();

        if (data.error) return console.error(data.message);
        this.store.set('lastFmSessionKey', data.session.key);
    }

    public async authenticate(): Promise<void> {
        if (this.isAuthenticating) return; // prevent multiple auth attempts

        const apikey = this.store.get('lastFmApiKey');
        const secret = this.store.get('lastFmSecret');

        if (!this.store.get('lastFmEnabled') || !apikey || !secret || this.store.get('lastFmSessionKey')) return;
        if (!this.window.webContents.getURL().startsWith('https://soundcloud.com/')) return;

        this.isAuthenticating = true; // lock auth process

        const authUrl = `https://www.last.fm/api/auth/?api_key=${apikey}&cb=https://soundcloud.com/discover`;
        // load auth url &&& wait for redirect
        await this.window.webContents.loadURL(authUrl);

        this.window.webContents.on('will-redirect', async (_, url) => {
            const token = new URL(url).searchParams.get('token');
            if (token) {
                await this.getLastFmSession(apikey as string, token);
                this.window.webContents.loadURL('https://soundcloud.com/discover');
            }
        });
    }

    private async scrobbleTrack(artist: string, track: string, timestamp: number): Promise<void> {
        const data = await this.sendLastFmRequest('track.scrobble', {
            artist,
            track,
            timestamp: timestamp.toString(),
        });

        if (data?.error) {
            console.error('Last.fm scrobble rejection:', data.message);
        } else if (data) {
            console.log(`[Last.fm] Scrobbled: ${artist} - ${track}`);
        }
    }

    private async updateNowPlaying(artist: string, track: string): Promise<void> {
        const data = await this.sendLastFmRequest('track.updateNowPlaying', { artist, track });
        if (data?.error) console.error('Last.fm presence error:', data.message);
    }

    public async updateTrackInfo(trackInfo: LastFmTrackData, isPlaying: boolean = true): Promise<void> {
        if (!this.store.get('lastFmEnabled') || !trackInfo.title || !trackInfo.author) return;

        const parsed = normalizeTrackInfo(
            trackInfo.title,
            trackInfo.author,
            this.store.get('trackParserEnabled', true) as boolean,
        );
        let shouldPingPresence = false;

        if (this.currentScrobbleState) {
            if (!isPlaying && !this.currentScrobbleState.isPaused) {
                this.currentScrobbleState.isPaused = true;
                this.pauseStartTime = Date.now();
            } else if (isPlaying && this.currentScrobbleState.isPaused) {
                this.currentScrobbleState.isPaused = false;
                this.currentScrobbleState.pausedTime += (Date.now() - this.pauseStartTime) / 1000;
                this.pauseStartTime = 0;
                shouldPingPresence = true;
            }
        }

        const elapsedSeconds = timeStringToSeconds(trackInfo.elapsed);
        const isDomLoop =
            this.currentScrobbleState &&
            this.currentScrobbleState.artist === parsed.artist &&
            this.currentScrobbleState.title === parsed.track &&
            elapsedSeconds <= this.currentScrobbleState.lastElapsedSeconds - 3;

        if (
            !this.currentScrobbleState ||
            this.currentScrobbleState.artist !== parsed.artist ||
            this.currentScrobbleState.title !== parsed.track ||
            isDomLoop
        ) {
            if (this.loopWatchdog) clearInterval(this.loopWatchdog);

            if (
                this.currentScrobbleState &&
                !this.currentScrobbleState.scrobbled &&
                shouldScrobble(this.currentScrobbleState)
            ) {
                await this.scrobbleTrack(
                    this.currentScrobbleState.artist,
                    this.currentScrobbleState.title,
                    Math.floor(this.currentScrobbleState.startTime / 1000),
                );
            }

            const trackDuration = timeStringToSeconds(trackInfo.duration);

            this.currentScrobbleState = {
                artist: parsed.artist,
                title: parsed.track,
                startTime: Date.now(),
                duration: trackDuration,
                scrobbled: false,
                isPaused: !isPlaying,
                pausedTime: 0,
                lastElapsedSeconds: elapsedSeconds,
            };

            if (!isPlaying) this.pauseStartTime = Date.now();
            shouldPingPresence = true;

            // pacemaker (pause-drift immunity)
            if (trackDuration > 0) {
                this.loopWatchdog = setInterval(async () => {
                    if (!this.currentScrobbleState || this.currentScrobbleState.isPaused) return;

                    const effectivePlaytime =
                        (Date.now() - this.currentScrobbleState.startTime) / 1000 -
                        this.currentScrobbleState.pausedTime;

                    if (!this.currentScrobbleState.scrobbled && shouldScrobble(this.currentScrobbleState)) {
                        await this.scrobbleTrack(
                            this.currentScrobbleState.artist,
                            this.currentScrobbleState.title,
                            Math.floor(this.currentScrobbleState.startTime / 1000),
                        );
                        this.currentScrobbleState.scrobbled = true;
                    }

                    if (effectivePlaytime >= this.currentScrobbleState.duration) {
                        this.currentScrobbleState.startTime = Date.now();
                        this.currentScrobbleState.pausedTime = 0;
                        this.currentScrobbleState.scrobbled = false;
                        this.currentScrobbleState.lastElapsedSeconds = 0;
                        await this.updateNowPlaying(this.currentScrobbleState.artist, this.currentScrobbleState.title);
                    }
                }, 1000);
            }
        } else if (this.currentScrobbleState.duration === 0) {
            const updatedDur = timeStringToSeconds(trackInfo.duration);
            if (updatedDur > 0) this.currentScrobbleState.duration = updatedDur;
        }

        if (isPlaying && shouldPingPresence) {
            await this.updateNowPlaying(parsed.artist, parsed.track);
        }

        if (this.currentScrobbleState) {
            this.currentScrobbleState.lastElapsedSeconds = elapsedSeconds;
        }
    }

    public disconnect(): void {
        if (this.loopWatchdog) clearInterval(this.loopWatchdog);
        this.isAuthenticating = false;
        this.store.set('lastFmEnabled', false);
        this.store.delete('lastFmApiKey');
        this.store.delete('lastFmSecret');
        this.store.delete('lastFmSessionKey');
        this.window.webContents.reload();
    }
}
