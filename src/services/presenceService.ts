import { BrowserWindow } from 'electron';
import type ElectronStore = require('electron-store');
import { ActivityType } from 'discord-api-types/v10';
import { Client as DiscordClient, SetActivity } from '@xhayper/discord-rpc';
import { TranslationService } from './translationService';

export interface Info {
    rpc: DiscordClient;
    ready: boolean;
    autoReconnect: boolean;
}

export class PresenceService {
    private window: BrowserWindow;
    private store: ElectronStore;
    private info: Info;
    private displayWhenIdling: boolean;
    private displaySCSmallIcon: boolean;
    private displayButtons: boolean;
    private translationService: TranslationService;

    constructor(window: BrowserWindow, store: ElectronStore, translationService: TranslationService) {
        this.window = window;
        this.store = store;
        this.displayWhenIdling = store.get('displayWhenIdling', false) as boolean;
        this.displaySCSmallIcon = store.get('displaySCSmallIcon', false) as boolean;
        this.displayButtons = store.get('displayButtons', false) as boolean;
        this.translationService = translationService;

        this.info = {
            rpc: new DiscordClient({
                clientId: '1090770350251458592',
            }),
            ready: false,
            autoReconnect: true,
        };

        this.info.rpc.login().catch(console.error);
    }

    public async updatePresence(trackInfo: {
        title: string;
        author: string;
        artwork: string;
        elapsed: string;
        duration: string;
        isPlaying: boolean;
        url: string;
    }): Promise<void> {
        try {
            if (!this.store.get('discordRichPresence')) {
                this.clearActivity();
                return;
            }

            if (trackInfo.isPlaying) {
                if (!trackInfo.title || !trackInfo.author) {
                    console.log('Incomplete track info:', trackInfo);
                    return;
                }

                const currentTrack = {
                    author: trackInfo.author,
                    title: trackInfo.title
                        .replace(/.*?:\s*/, '')
                        .replace(/\n.*/, '')
                        .trim(),
                    url: trackInfo.url,
                };

                const [elapsedTime, totalTime] = [trackInfo.elapsed, trackInfo.duration];
                const artworkUrl = trackInfo.artwork;

                const parseTime = (time: string): number => {
                    const parts = time.split(':').map(Number);
                    return parts.reduce((acc, part) => 60 * acc + part, 0) * 1000;
                };

                const elapsedMilliseconds = parseTime(elapsedTime);
                const totalMilliseconds = parseTime(totalTime);

                if (!this.info.rpc.isConnected) {
                    if (await !this.info.rpc.login().catch(console.error)) {
                        return;
                    }
                }

                const activity: SetActivity = {
                    type: ActivityType.Listening,
                    details: `${this.shortenString(currentTrack.title)}${currentTrack.title.length < 2 ? '⠀⠀' : ''}`,
                    state: `${this.shortenString(trackInfo.author)}${trackInfo.author.length < 2 ? '⠀⠀' : ''}`,
                    largeImageKey: artworkUrl.replace('50x50.', '500x500.'),
                    startTimestamp: Date.now() - elapsedMilliseconds,
                    endTimestamp: Date.now() + (totalMilliseconds - elapsedMilliseconds),
                    smallImageKey: this.displaySCSmallIcon ? 'soundcloud-logo' : '',
                    smallImageText: this.displaySCSmallIcon ? 'SoundCloud' : '',
                    instance: false,
                };

                if (this.displayButtons && currentTrack.url) {
                    activity.buttons = [
                        {
                            label: `▶️ ${this.translationService.translate('listenOnSoundcloud')}`,
                            url: currentTrack.url
                        }
                    ];
                }

                this.info.rpc.user?.setActivity(activity);
            } else if (this.displayWhenIdling && this.store.get('discordRichPresence')) {
                this.info.rpc.user?.setActivity({
                    details: 'Listening to SoundCloud',
                    state: 'Paused',
                    largeImageKey: 'idling',
                    largeImageText: 'Paused',
                    smallImageKey: 'soundcloud-logo',
                    smallImageText: 'SoundCloud',
                    instance: false,
                });
            } else {
                this.info.rpc.user?.clearActivity();
            }
        } catch (error) {
            console.error('Error during RPC update:', error);
        }
    }

    public updateDisplaySettings(displayWhenIdling: boolean, displaySCSmallIcon: boolean, displayButtons?: boolean): void {
        this.displayWhenIdling = displayWhenIdling;
        this.displaySCSmallIcon = displaySCSmallIcon;
        if (displayButtons !== undefined) {
            this.displayButtons = displayButtons;
        }
    }

    public async reconnect(): Promise<void> {
        await this.info.rpc.login().catch(console.error);
    }

    public isConnected(): boolean {
        return this.info.rpc.isConnected;
    }

    public clearActivity(): void {
        this.info.rpc.user?.clearActivity();
    }

    private shortenString(str: string): string {
        return str.length > 128 ? str.substring(0, 128) + '...' : str;
    }
} 