import type { TrackInfo, TrackUpdateMessage } from './types';

export const TRACK_UPDATE_REASONS = new Set([
    'playback-state-change',
    'track-change',
    'seek-change',
    'initial-state',
    'waveform-seek',
    'timeline-seek',
]);

export function cleanTrackString(value: unknown, maxLength: number): string {
    if (typeof value !== 'string') return '';
    return Array.from(value)
        .filter((char) => {
            const code = char.charCodeAt(0);
            return code >= 32 && code !== 127;
        })
        .join('')
        .trim()
        .slice(0, maxLength);
}

export function cleanTrackUrl(value: unknown): string {
    const raw = cleanTrackString(value, 2048);
    if (!raw) return '';

    try {
        const url = new URL(raw);
        return url.protocol === 'https:' ? url.toString() : '';
    } catch {
        return '';
    }
}

export function validateTrackInfo(data: unknown): TrackInfo | null {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const input = data as Partial<Record<keyof TrackInfo, unknown>>;

    return {
        title: cleanTrackString(input.title, 300),
        author: cleanTrackString(input.author, 200),
        artwork: cleanTrackUrl(input.artwork),
        elapsed: cleanTrackString(input.elapsed, 32),
        duration: cleanTrackString(input.duration, 32),
        isPlaying: typeof input.isPlaying === 'boolean' ? input.isPlaying : false,
        url: cleanTrackUrl(input.url),
    };
}

export function validateTrackUpdatePayload(payload: unknown): TrackUpdateMessage | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const input = payload as Partial<TrackUpdateMessage>;
    const data = validateTrackInfo(input.data);
    if (!data) return null;
    const reason =
        typeof input.reason === 'string' && TRACK_UPDATE_REASONS.has(input.reason) ? input.reason : 'track-change';

    return { data, reason };
}
