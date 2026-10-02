/**
 * Core type definitions for the SoundCloud RPC application
 */

/**
 * Information about the currently playing track
 */
export interface TrackInfo {
    /** Title of the track */
    title: string;
    /** Author/artist of the track */
    author: string;
    /** URL to the track's artwork image */
    artwork: string;
    /** Elapsed playback time (format: "MM:SS" or "H:MM:SS") */
    elapsed: string;
    /** Total duration of the track (format: "MM:SS" or "H:MM:SS") */
    duration: string;
    /** Whether the track is currently playing */
    isPlaying: boolean;
    /** Whether the track is liked by the user */
    isLiked: boolean;
    /** SoundCloud URL of the track */
    url: string;
}

/**
 * Data required for Last.fm scrobbling
 */
export interface LastFmTrackData {
    /** Title of the track */
    title: string;
    /** Author/artist of the track */
    author: string;
    /** Total duration of the track */
    duration: string;
    /** Elapsed playback time (format: "MM:SS" or "H:MM:SS") */
    elapsed: string;
}

/**
 * Data sent to webhooks
 */
export interface WebhookTrackData extends LastFmTrackData {
    /** SoundCloud URL of the track */
    url: string;
    /** URL to the track's artwork image */
    artwork: string;
}

/**
 * Parsed track information with artist and track name separated
 */
export interface ParsedTrackInfo {
    /** Parsed artist name (null if not found) */
    artist: string | null;
    /** Parsed track name */
    track: string;
}

/**
 * Normalized track information for display
 */
export interface NormalizedTrackInfo {
    /** Artist name (never null, defaults to "Unknown Artist") */
    artist: string;
    /** Track name (never null, defaults to "Unknown Track") */
    track: string;
}

/**
 * Update reason for track state changes
 */
export type TrackUpdateReason = 'playback-state-change' | 'track-change' | 'seek-change' | 'initial-state';

/**
 * Message sent from renderer to main process for track updates
 */
export interface TrackUpdateMessage {
    /** Track information */
    data: TrackInfo;
    /** Reason for the update */
    reason: TrackUpdateReason;
}
