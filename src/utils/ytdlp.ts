import { existsSync } from 'fs';
import { homedir } from 'os';
import { delimiter, join } from 'path';

export const DEFAULT_TEMPLATE = '%(uploader)s - %(title)s.%(ext)s';

const PROGRESS_PREFIX = 'SCRPC_PROGRESS ';
const FILE_PREFIX = 'SCRPC_FILE ';

// One JSON object per progress tick. `|null` because a missing field would otherwise print as a
// bare NA, and `j` escapes titles to ASCII, so the line survives any console encoding.
const PROGRESS_FIELDS = {
    status: 'progress.status',
    downloaded: 'progress.downloaded_bytes',
    total: 'progress.total_bytes',
    estimate: 'progress.total_bytes_estimate',
    speed: 'progress.speed',
    eta: 'progress.eta',
    title: 'info.title',
    index: 'info.playlist_index',
    count: 'info.n_entries',
};
const PROGRESS_TEMPLATE =
    `download:${PROGRESS_PREFIX}{` +
    Object.entries(PROGRESS_FIELDS)
        .map(([key, field]) => `"${key}":%(${field}|null)j`)
        .join(',') +
    '}';

export interface DownloadOptions {
    folder: string;
    template: string;
    /** read the account options built by `authConfig` from stdin */
    auth?: boolean;
}

/**
 * yt-dlp options that sign it in to SoundCloud as the app's logged-in account, which is what makes
 * Go+ streams and uploader-enabled original files available. Written to yt-dlp's stdin instead of
 * its command line, where any local process could read the token.
 *
 * The token comes from a cookie, i.e. from the web, and this text is parsed as options: anything
 * but a plain token is refused, or a crafted cookie could smuggle in `--exec`.
 */
export function authConfig(token: string): string | null {
    return /^[A-Za-z0-9_-]{1,256}$/.test(token) ? `--username oauth\n--password ${token}\n` : null;
}

// The uploader's original file when they offer one (SoundCloud only hands it to a signed-in account),
// otherwise the best full stream. Previews are excluded: a Go+ track this account cannot play would
// otherwise "succeed" as its 30-second sample.
const FORMAT = 'download/bestaudio[format_id!*=preview]';

// Saved as SoundCloud serves it. There is deliberately no conversion option: re-encoding a lossy
// stream to FLAC or WAV only produces a bigger file that claims to be lossless.
export function buildArgs(url: string, options: DownloadOptions): string[] {
    return [
        ...(options.auth ? ['--config-locations', '-'] : []),
        '--newline',
        // --print implies --quiet, which would drop the progress lines
        '--progress',
        '--progress-template',
        PROGRESS_TEMPLATE,
        '--print',
        `after_move:${FILE_PREFIX}%(filepath)j`,
        '-f',
        FORMAT,
        '-P',
        options.folder,
        '-o',
        options.template.trim() || DEFAULT_TEMPLATE,
        // everything after this is a URL, never an option
        '--',
        url,
    ];
}

/**
 * Why yt-dlp left a track out, for the popup, or null for any other line. Read off the failure itself:
 * asking SoundCloud about every track up front would double the requests. yt-dlp skips such a track
 * and carries on with the rest of an album or playlist.
 */
export function skipReason(line: string): string | null {
    if (!line.startsWith('ERROR:')) return null;
    if (/DRM protected/i.test(line)) return 'DRM-protected';
    // only previews were left for FORMAT to refuse
    if (/Requested format is not available/i.test(line)) return 'Go+ only';
    if (/HTTP Error 40[13]/.test(line)) return 'not authorized';
    return null;
}

export interface DownloadProgress {
    status: string | null;
    downloaded: number | null;
    total: number | null;
    speed: number | null;
    eta: number | null;
    title: string | null;
    index: number | null;
    count: number | null;
}

export type YtDlpLine = { progress: DownloadProgress } | { file: string } | null;

const numberOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const stringOrNull = (value: unknown) => (typeof value === 'string' ? value : null);

export function parseLine(line: string): YtDlpLine {
    try {
        if (line.startsWith(FILE_PREFIX)) {
            const file: unknown = JSON.parse(line.slice(FILE_PREFIX.length));
            return typeof file === 'string' ? { file } : null;
        }
        if (line.startsWith(PROGRESS_PREFIX)) {
            const raw = JSON.parse(line.slice(PROGRESS_PREFIX.length)) as Record<string, unknown>;
            const downloaded = numberOrNull(raw.downloaded);
            const total = numberOrNull(raw.total) ?? numberOrNull(raw.estimate);
            const speed = numberOrNull(raw.speed);
            return {
                progress: {
                    status: stringOrNull(raw.status),
                    downloaded,
                    total,
                    speed,
                    // yt-dlp reports no ETA for the HLS streams SoundCloud mostly serves, so work it out
                    eta:
                        numberOrNull(raw.eta) ??
                        (downloaded !== null && total && speed ? Math.max(0, total - downloaded) / speed : null),
                    title: stringOrNull(raw.title),
                    index: numberOrNull(raw.index),
                    count: numberOrNull(raw.count),
                },
            };
        }
    } catch {
        // a line that was cut short, or NaN in a field
    }
    return null;
}

// A packaged GUI app gets a bare PATH on macOS and Linux, so the usual install locations are added.
// The same list is handed to yt-dlp as its PATH, so it can find ffmpeg, which it uses to stitch HLS streams.
export function searchDirs(env: NodeJS.ProcessEnv = process.env): string[] {
    return [
        ...(env.PATH ?? '').split(delimiter),
        '/opt/homebrew/bin',
        '/usr/local/bin',
        join(homedir(), '.local', 'bin'),
    ].filter(Boolean);
}

/** `customPath` wins outright when set, so a typo there is reported instead of silently ignored. */
export function findYtDlp(customPath: string, dirs = searchDirs()): string | null {
    const name = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const candidates = customPath.trim() ? [customPath.trim()] : dirs.map((dir) => join(dir, name));
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
