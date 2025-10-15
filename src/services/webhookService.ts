import type ElectronStore = require('electron-store');
import fetch from 'cross-fetch';
import { normalizeTrackInfo } from '../utils/trackParser';
import type { WebhookTrackData as WebhookInputData } from '../types';

export interface WebhookTrackData {
    artist: string;
    track: string;
    album?: string;
    albumArtist?: string;
    duration: number;
    trackArt?: string;
    originUrl: string;
}

export interface WebhookState {
    artist: string;
    track: string;
    startTime: number;
    duration: number;
    webhookSent: boolean;
    originUrl: string;
    trackArt: string;
}

function timeStringToSeconds(timeStr: string | undefined): number {
    if (!timeStr || typeof timeStr !== 'string') return 240;
    try {
        const isNegative = timeStr.trim().startsWith('-');
        const raw = isNegative ? timeStr.trim().slice(1) : timeStr.trim();
        const parts = raw.split(':').map((p) => Number(p));
        let seconds = 0;
        for (const part of parts) {
            seconds = seconds * 60 + (isNaN(part) ? 0 : part);
        }
        return Math.max(1, Math.abs(seconds));
    } catch (error) {
        console.error('Error parsing time string:', error);
        return 240;
    }
}

function shouldSendWebhook(state: WebhookState, triggerPercentage: number): boolean {
    const playedTime = (Date.now() - state.startTime) / 1000;
    const targetTime = (state.duration * triggerPercentage) / 100;

    return !state.webhookSent && playedTime >= targetTime;
}

export class WebhookService {
    private store: ElectronStore;
    private currentWebhookState: WebhookState | null = null;
    private webhookTimeout: NodeJS.Timeout | null = null;

    constructor(store: ElectronStore) {
        this.store = store;
    }

    private scheduleWebhook(): void {
        if (this.webhookTimeout) {
            clearTimeout(this.webhookTimeout);
            this.webhookTimeout = null;
        }

        if (!this.currentWebhookState || this.currentWebhookState.webhookSent) {
            return;
        }

        const webhookEnabled = this.store.get('webhookEnabled') as boolean;
        if (!webhookEnabled) return;

        const triggerPercentage = (this.store.get('webhookTriggerPercentage') as number) || 50;
        const targetTime = (this.currentWebhookState.duration * triggerPercentage) / 100;
        const currentTime = (Date.now() - this.currentWebhookState.startTime) / 1000;
        const remainingTime = Math.max(0, targetTime - currentTime);

        if (remainingTime <= 0) {
            this.sendScheduledWebhook();
        } else {
            this.webhookTimeout = setTimeout(() => {
                this.sendScheduledWebhook();
            }, remainingTime * 1000);
        }
    }

    private async sendScheduledWebhook(): Promise<void> {
        if (!this.currentWebhookState || this.currentWebhookState.webhookSent) {
            return;
        }

        await this.sendWebhook({
            artist: this.currentWebhookState.artist,
            track: this.currentWebhookState.track,
            duration: this.currentWebhookState.duration,
            originUrl: this.currentWebhookState.originUrl,
            trackArt: this.currentWebhookState.trackArt,
        });

        this.currentWebhookState.webhookSent = true;
    }

    private async sendWebhook(trackData: WebhookTrackData): Promise<void> {
        const webhookUrl = this.store.get('webhookUrl') as string;
        const webhookEnabled = this.store.get('webhookEnabled') as boolean;

        if (!webhookEnabled || !webhookUrl) {
            return;
        }

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    ...trackData,
                }),
            });

            if (!response.ok) {
                console.error('Webhook failed:', response.status, response.statusText);
            } else {
                console.log(`Webhook sent for ${trackData.artist} - ${trackData.track}`);
            }
        } catch (error) {
            console.error('Failed to send webhook:', error);
        }
    }

    public async updateTrackInfo(trackInfo: WebhookInputData): Promise<void> {
        const webhookEnabled = this.store.get('webhookEnabled') as boolean;
        if (!webhookEnabled) return;

        if (!trackInfo.title || !trackInfo.author) {
            return;
        }

        const normalizedTrack = normalizeTrackInfo(
            trackInfo.title,
            trackInfo.author,
            this.store.get('trackParserEnabled', true) as boolean,
        );
        const currentTrack = {
            artist: normalizedTrack.artist,
            track: normalizedTrack.track,
        };

        const triggerPercentage = (this.store.get('webhookTriggerPercentage') as number) || 50;

        // Check for loop (elapsed time <= 3 seconds on same track)
        const elapsedSeconds = timeStringToSeconds(trackInfo.elapsed);
        const isLoop = this.currentWebhookState &&
            this.currentWebhookState.artist === currentTrack.artist &&
            this.currentWebhookState.track === currentTrack.track &&
            elapsedSeconds <= 3;

        if (
            !this.currentWebhookState ||
            this.currentWebhookState.artist !== currentTrack.artist ||
            this.currentWebhookState.track !== currentTrack.track ||
            isLoop
        ) {
            if (
                this.currentWebhookState &&
                !this.currentWebhookState.webhookSent &&
                shouldSendWebhook(this.currentWebhookState, triggerPercentage)
            ) {
                await this.sendWebhook({
                    artist: this.currentWebhookState.artist,
                    track: this.currentWebhookState.track,
                    duration: this.currentWebhookState.duration,
                    originUrl: this.currentWebhookState.originUrl,
                    trackArt: this.currentWebhookState.trackArt,
                });
            }

            this.currentWebhookState = {
                artist: currentTrack.artist,
                track: currentTrack.track,
                startTime: Date.now(),
                duration: timeStringToSeconds(trackInfo.duration),
                webhookSent: false,
                originUrl: trackInfo.url,
                trackArt: trackInfo.artwork,
            };

            this.scheduleWebhook();
        }

        if (
            this.currentWebhookState &&
            !this.currentWebhookState.webhookSent &&
            shouldSendWebhook(this.currentWebhookState, triggerPercentage)
        ) {
            await this.sendWebhook({
                artist: this.currentWebhookState.artist,
                track: this.currentWebhookState.track,
                duration: this.currentWebhookState.duration,
                originUrl: this.currentWebhookState.originUrl,
                trackArt: this.currentWebhookState.trackArt,
            });
            this.currentWebhookState.webhookSent = true;
        }
    }

    public setTriggerPercentage(percentage: number): void {
        let validPercentage = Math.max(0, Math.min(100, percentage));
        if (isNaN(validPercentage)) {
            validPercentage = 50;
        }
        this.store.set('webhookTriggerPercentage', validPercentage);
    }

    public setWebhookUrl(url: string): void {
        this.store.set('webhookUrl', url);
    }

    public setEnabled(enabled: boolean): void {
        this.store.set('webhookEnabled', enabled);
    }

    public disconnect(): void {
        if (this.webhookTimeout) {
            clearTimeout(this.webhookTimeout);
            this.webhookTimeout = null;
        }
        this.store.set('webhookEnabled', false);
        this.store.delete('webhookUrl');
        this.store.delete('webhookTriggerPercentage');
    }
}
