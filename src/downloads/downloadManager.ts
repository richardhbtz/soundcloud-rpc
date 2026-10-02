import { app, BrowserView, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import type ElectronStore from 'electron-store';
import { spawn, type ChildProcess } from 'child_process';
import { statSync } from 'fs';
import { delimiter, join } from 'path';
import { createInterface } from 'readline';
import type { ThemeColors } from '../utils/colorExtractor';
import { applyNavigationPolicy } from '../utils/navigationPolicy';
import { appUrl, cspMetaTag, provideDocument } from '../utils/appProtocol';
import { markTrustedSender, trustedHandle, trustedOn } from '../utils/ipcGuard';
import { authConfig, buildArgs, DEFAULT_TEMPLATE, findYtDlp, parseLine, searchDirs, skipReason } from '../utils/ytdlp';

const isMac = process.platform === 'darwin';
const HEADER_HEIGHT = 32;
const MAX_CONCURRENT = 2;

interface DownloadItem {
    id: number;
    url: string;
    /** the track being fetched right now; for a playlist this changes as it goes */
    title: string;
    status: 'queued' | 'downloading' | 'processing' | 'done' | 'error' | 'cancelled';
    downloaded: number | null;
    total: number | null;
    speed: number | null;
    eta: number | null;
    index: number | null;
    count: number | null;
    /** finished files so far, their combined size, and the last one's path */
    files: number;
    size: number;
    file: string;
    /** one `skipReason` per track yt-dlp had to leave out */
    skipped: string[];
    error: string;
}

export function downloadFolder(store: ElectronStore): string {
    return (store.get('downloadFolder') as string) || app.getPath('downloads');
}

export class DownloadManager {
    private view: BrowserView | null = null;
    private parentWindow: BrowserWindow;
    private store: ElectronStore;
    private onActiveChange: (active: number) => void;
    private themeColors: ThemeColors | null = null;
    private devMode = process.argv.includes('--dev');
    // newest first, which is the order the popup lists them in
    private items: DownloadItem[] = [];
    private processes = new Map<number, ChildProcess>();
    // yt-dlp sign-in options per queued download; kept out of `items`, which the popup's renderer receives
    private auth = new Map<number, string>();
    private nextId = 1;
    private pushTimer: NodeJS.Timeout | null = null;

    constructor(parentWindow: BrowserWindow, store: ElectronStore, onActiveChange: (active: number) => void) {
        this.parentWindow = parentWindow;
        this.store = store;
        this.onActiveChange = onActiveChange;

        this.parentWindow.on('resize', () => this.updateBounds());
        this.setupIpcHandlers();
    }

    /** `token` is the session's SoundCloud oauth token, or empty to download anonymously. */
    public start(url: string, token = ''): void {
        const auth = authConfig(token);
        if (auth) this.auth.set(this.nextId, auth);

        let title = url;
        try {
            title = decodeURIComponent(new URL(url).pathname).slice(1) || url;
        } catch {
            // the address stands in until yt-dlp reports the real title
        }

        this.items.unshift({
            id: this.nextId++,
            url,
            title,
            status: 'queued',
            downloaded: null,
            total: null,
            speed: null,
            eta: null,
            index: null,
            count: null,
            files: 0,
            size: 0,
            file: '',
            skipped: [],
            error: '',
        });
        this.show();
        this.runQueued();
    }

    private runQueued(): void {
        // oldest first
        for (const item of [...this.items].reverse()) {
            if (this.processes.size >= MAX_CONCURRENT) break;
            if (item.status === 'queued') this.run(item);
        }
        this.changed();
    }

    private run(item: DownloadItem): void {
        const auth = this.auth.get(item.id);
        this.auth.delete(item.id);

        const binary = findYtDlp(this.store.get('ytDlpPath', '') as string);
        if (!binary) {
            item.status = 'error';
            item.error =
                'yt-dlp was not found. Install it (brew, winget or pip install yt-dlp) or set its path in Settings.';
            return;
        }

        const child = spawn(
            binary,
            buildArgs(item.url, {
                folder: downloadFolder(this.store),
                template: this.store.get('downloadTemplate', DEFAULT_TEMPLATE) as string,
                auth: !!auth,
            }),
            {
                env: { ...process.env, PATH: searchDirs().join(delimiter) },
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true,
            },
        );
        // a write to a yt-dlp that failed to start must not take the app down; 'error' below reports it
        child.stdin.on('error', () => {});
        child.stdin.end(auth ?? '');
        this.processes.set(item.id, child);
        item.status = 'downloading';

        createInterface({ input: child.stdout }).on('line', (line) => {
            const parsed = parseLine(line);
            if (!parsed || item.status === 'cancelled') return;

            if ('file' in parsed) {
                item.file = parsed.file;
                item.files += 1;
                try {
                    item.size += statSync(parsed.file).size;
                } catch {
                    // moved or deleted already; the size is only for display
                }
            } else {
                const { status, title, ...progress } = parsed.progress;
                Object.assign(item, progress);
                if (title) item.title = title;
                // yt-dlp reports 'finished' once the bytes are in; conversion and tagging follow
                item.status = status === 'finished' ? 'processing' : 'downloading';
            }
            this.changed();
        });

        createInterface({ input: child.stderr }).on('line', (line) => {
            const reason = skipReason(line);
            if (reason) item.skipped.push(reason);
            else if (line.startsWith('ERROR:')) item.error = line.slice('ERROR:'.length).trim();
        });

        // 'error' (could not start) and 'close' can both fire; whichever comes first settles it
        const settle = (error: string) => {
            if (!this.processes.delete(item.id)) return;
            if (item.status !== 'cancelled') {
                item.status = error ? 'error' : 'done';
                item.error = error;
            }
            this.runQueued();
        };
        child.on('error', (error) => settle(error.message));
        child.on('close', (code) => {
            if (code === 0 || item.error) return settle(item.error);
            // tracks yt-dlp could not have are skipped, not failed: the rest of an album or playlist still counts
            if (!item.skipped.length) return settle(`yt-dlp exited with code ${code}`);
            if (item.files) return settle('');
            const reasons = [...new Set(item.skipped)].join(', ');
            settle(
                item.skipped.length > 1
                    ? `None of the ${item.skipped.length} tracks can be downloaded (${reasons})`
                    : `This track can't be downloaded (${reasons})`,
            );
        });
    }

    private cancel(id: unknown): void {
        const item = this.items.find((entry) => entry.id === id);
        if (!item || !['queued', 'downloading', 'processing'].includes(item.status)) return;

        item.status = 'cancelled';
        this.auth.delete(item.id);
        // ponytail: yt-dlp leaves its .part file behind; delete it here if the leftovers bother anyone
        this.processes.get(item.id)?.kill();
        this.changed();
    }

    /** Stops every running download; yt-dlp would otherwise outlive the app. */
    public cancelAll(): void {
        for (const child of this.processes.values()) child.kill();
    }

    // yt-dlp reports progress many times a second per download; the popup gets the whole list at most 5x a second
    private changed(): void {
        if (this.pushTimer) return;
        this.pushTimer = setTimeout(() => {
            this.pushTimer = null;
            if (this.view && !this.view.webContents.isDestroyed()) {
                this.view.webContents.send('downloads-changed', this.items);
            }
            this.onActiveChange(this.processes.size);
        }, 200);
    }

    public setThemeColors(colors: ThemeColors | null): void {
        this.themeColors = colors;
    }

    public toggle(): void {
        if (this.view) this.hide();
        else this.show();
    }

    private show(): void {
        if (this.view) return;

        this.view = new BrowserView({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true,
                allowRunningInsecureContent: false,
                nodeIntegrationInSubFrames: false,
                nodeIntegrationInWorker: false,
                preload: join(__dirname, 'downloadsPreload.js'),
                devTools: this.devMode,
                ...(isMac ? { spellcheck: false } : {}),
            },
        });
        applyNavigationPolicy(this.view.webContents);
        markTrustedSender(this.view.webContents);

        this.parentWindow.addBrowserView(this.view);
        this.updateBounds();

        provideDocument('downloads', () => this.getHtml());
        this.view.webContents.loadURL(appUrl('downloads'));
    }

    // Torn down rather than parked off-screen, like the toast: the popup is rebuilt from `items` on
    // every open, which is also how it picks up a theme change.
    private hide(): void {
        if (!this.view) return;
        const view = this.view;
        this.view = null;
        try {
            this.parentWindow.removeBrowserView(view);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (view.webContents as any).destroy();
        } catch {
            // the window is already gone
        }
    }

    // hangs off the header's download button, at the top right
    private updateBounds(): void {
        if (!this.view) return;
        const { width, height } = this.parentWindow.getContentBounds();
        const viewWidth = Math.min(380, width - 16);

        this.view.setBounds({
            x: width - viewWidth - 8,
            y: HEADER_HEIGHT + 4,
            width: viewWidth,
            height: Math.max(120, Math.min(420, height - HEADER_HEIGHT - 16)),
        });
    }

    private setupIpcHandlers(): void {
        ipcMain.handle(
            'get-downloads',
            trustedHandle(() => this.items, 'get-downloads'),
        );
        ipcMain.on(
            'toggle-downloads',
            trustedOn(() => this.toggle(), 'toggle-downloads'),
        );
        ipcMain.on(
            'downloads-cancel',
            trustedOn((_event, id: unknown) => this.cancel(id), 'downloads-cancel'),
        );
        ipcMain.on(
            'downloads-clear',
            trustedOn(() => {
                this.items = this.items.filter((item) => this.processes.has(item.id) || item.status === 'queued');
                this.changed();
            }, 'downloads-clear'),
        );
        // the renderer names a download, never a path
        ipcMain.on(
            'downloads-show',
            trustedOn((_event, id: unknown) => {
                const file = this.items.find((item) => item.id === id)?.file;
                if (file) shell.showItemInFolder(file);
            }, 'downloads-show'),
        );
        ipcMain.on(
            'downloads-open-folder',
            trustedOn(() => void shell.openPath(downloadFolder(this.store)), 'downloads-open-folder'),
        );
        ipcMain.handle(
            'choose-download-folder',
            trustedHandle(async () => {
                const result = await dialog.showOpenDialog(this.parentWindow, {
                    defaultPath: downloadFolder(this.store),
                    properties: ['openDirectory', 'createDirectory'],
                });
                if (!result.canceled && result.filePaths[0]) this.store.set('downloadFolder', result.filePaths[0]);
                return downloadFolder(this.store);
            }, 'choose-download-folder'),
        );
    }

    private getHtml(): string {
        const isDark = this.store.get('theme', 'dark') !== 'light';
        const background = this.themeColors?.surface || (isDark ? '#303030' : '#ffffff');
        const text = this.themeColors?.text || (isDark ? '#ffffff' : '#333333');
        const line = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';

        return `${cspMetaTag()}
        <style>
            * {
                box-sizing: border-box;
                margin: 0;
            }
            html, body {
                height: 100%;
                background: transparent;
            }
            body {
                display: flex;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13px;
                color: ${text};
                background: ${background};
                border: 1px solid ${line};
                border-radius: 10px;
                overflow: hidden;
                user-select: none;
                -webkit-font-smoothing: antialiased;
            }
            header {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 8px 8px 8px 12px;
                border-bottom: 1px solid ${line};
            }
            h1 {
                flex: 1;
                font-size: 14px;
                font-weight: 600;
            }
            button {
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                background: transparent;
                color: inherit;
                font: inherit;
                opacity: 0.7;
                cursor: pointer;
            }
            button:hover {
                opacity: 1;
                background: ${line};
            }
            #list {
                flex: 1;
                overflow-y: auto;
            }
            #empty {
                padding: 32px 12px;
                text-align: center;
                opacity: 0.6;
            }
            .row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 4px 8px;
                align-items: center;
                padding: 10px 8px 10px 12px;
                border-bottom: 1px solid ${line};
            }
            .title {
                font-weight: 600;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
            .row button {
                grid-row: span 3;
            }
            progress {
                width: 100%;
                height: 4px;
                appearance: none;
            }
            progress::-webkit-progress-bar {
                border-radius: 2px;
                background: ${line};
            }
            progress::-webkit-progress-value {
                border-radius: 2px;
                background: #ff5500;
            }
            .detail {
                font-size: 12px;
                opacity: 0.7;
                font-variant-numeric: tabular-nums;
            }
            .row.error .detail {
                color: #ff5500;
                opacity: 1;
                user-select: text;
            }
        </style>
        <header>
            <h1>Downloads</h1>
            <button id="open-folder" type="button">Open folder</button>
            <button id="clear" type="button">Clear</button>
            <button id="close" type="button" title="Close" aria-label="Close">&#x2715;</button>
        </header>
        <div id="empty">No downloads yet. Use the download button under a track, album or playlist.</div>
        <div id="list"></div>
        <script src="/downloadsPanel.js"></script>`;
    }
}
