import { app, ipcMain, type BrowserView } from 'electron';
import { readFileSync, existsSync, readdirSync, statSync, watch, mkdirSync } from 'fs';
import path, { join, basename, extname } from 'path';
import type ElectronStore from 'electron-store';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { parseMetadata, type FileMetadata } from '../utils/metadataParser';
import { Script, createContext, type Context } from 'vm';

export interface PluginInfo {
    id: string;
    filePath: string;
    metadata: FileMetadata;
    /** sha256 of the source that was scanned, used to detect swapped files */
    sourceHash: string;
    enabled: boolean;
}

/**
 * Stored approvals: plugin id -> sha256 of the source the user enabled.
 * `true` is the legacy shape written by older builds and is grandfathered in on
 * first scan, then rewritten as a hash.
 */
type PluginApprovals = Record<string, string | boolean>;

interface PluginRuntime {
    context: Context;
    exports: PluginExports;
}

interface PluginExports {
    onEnable?: () => void;
    onDisable?: () => void;
    onTrackChange?: (track: Record<string, unknown>) => void;
    onThemeChange?: (isDark: boolean) => void;
    contentScript?: () => string;
}

export class PluginService {
    private store: ElectronStore;
    private plugins: Map<string, PluginInfo> = new Map();
    private runtimes: Map<string, PluginRuntime> = new Map();
    private pluginsPath: string;
    private emitter = new EventEmitter();
    private stopWatching?: () => void;
    private contentView: BrowserView | null = null;

    constructor(store: ElectronStore) {
        this.store = store;
        // assign dynamic environment path
        this.pluginsPath = this.getPluginsPath();
        this.ensurePluginsDirectory();
        this.scanPlugins();
        this.setupIpcHandlers();
        this.startWatching();
        this.enableSavedPlugins();
    }

    private ensurePluginsDirectory(): void {
        try {
            if (!existsSync(this.pluginsPath)) {
                mkdirSync(this.pluginsPath, { recursive: true });
            }
        } catch (error) {
            console.error('Failed to create plugins directory:', error);
        }
    }

    private scanPlugins(): void {
        try {
            if (!existsSync(this.pluginsPath)) return;

            const approvals = (this.store.get('enabledPlugins', {}) as PluginApprovals) || {};
            const files = readdirSync(this.pluginsPath);

            for (const file of files) {
                const filePath = join(this.pluginsPath, file);
                const stat = statSync(filePath);

                if (!stat.isFile() || extname(file).toLowerCase() !== '.js') continue;

                try {
                    const source = readFileSync(filePath, 'utf-8');
                    const metadata = parseMetadata(source, 'js');
                    const id = basename(file, '.js');
                    const sourceHash = createHash('sha256').update(source).digest('hex');

                    if (!metadata.name) metadata.name = id;

                    // a plugin stays enabled only while its file is byte-for-byte what
                    // the user approved. dropping a different file under a
                    // previously-enabled name leaves it disabled until re-approved,
                    // rather than executing on sight.
                    const approved = approvals[id];
                    const enabled = approved === true || approved === sourceHash;

                    if (approved !== undefined && !enabled) {
                        console.warn(
                            `Plugin "${id}" changed on disk since it was enabled; it stays disabled until re-enabled.`,
                        );
                    }

                    this.plugins.set(id, {
                        id,
                        filePath,
                        metadata,
                        sourceHash,
                        enabled,
                    });
                } catch (error) {
                    console.error(`Failed to load plugin ${file}:`, error);
                }
            }
        } catch (error) {
            console.error('Failed to scan plugins:', error);
        }
    }

    private startWatching(): void {
        try {
            if (!existsSync(this.pluginsPath)) return;
            if (this.stopWatching) {
                this.stopWatching();
                this.stopWatching = undefined;
            }

            const watcher = watch(this.pluginsPath, { persistent: true }, (_eventType, filename) => {
                if (!filename || extname(filename).toLowerCase() !== '.js') return;
                Promise.resolve().then(() => this.refreshPlugins());
            });

            this.stopWatching = () => {
                try {
                    watcher.close();
                } catch {}
            };
        } catch (error) {
            console.error('Failed to watch plugins folder:', error);
        }
    }

    private enableSavedPlugins(): void {
        for (const [id, plugin] of this.plugins) {
            if (plugin.enabled) {
                this.activatePlugin(id);
            }
        }
    }

    private activatePlugin(id: string): boolean {
        const plugin = this.plugins.get(id);
        if (!plugin) return false;

        try {
            if (this.runtimes.has(id)) return true;

            const source = readFileSync(plugin.filePath, 'utf-8');
            // approve exactly what runs, so the stored hash can never drift from the
            // code that was actually executed
            plugin.sourceHash = createHash('sha256').update(source).digest('hex');

            const pluginExports: PluginExports = {};

            // NOTE: node's `vm` is NOT a security boundary, and the object below is not
            // a sandbox. a plugin can reach the real global through any function it is
            // handed -- `this.constructor.constructor('return process')()` is enough --
            // and from there it has the full main-process Node API: fs, child_process,
            // the lot. this only shapes a CommonJS-like module environment for
            // convenience. plugins are fully trusted code; installing one is equivalent
            // to installing a native application.
            const pluginGlobals = {
                module: { exports: pluginExports },
                exports: pluginExports,
                console: {
                    log: (...args: unknown[]) => console.log(`[plugin:${id}]`, ...args),
                    warn: (...args: unknown[]) => console.warn(`[plugin:${id}]`, ...args),
                    error: (...args: unknown[]) => console.error(`[plugin:${id}]`, ...args),
                },
                setTimeout,
                clearTimeout,
                setInterval,
                clearInterval,
            };

            const context = createContext(pluginGlobals);
            const script = new Script(source, { filename: plugin.filePath });
            script.runInContext(context);

            const resolved = pluginGlobals.module.exports || pluginGlobals.exports;
            this.runtimes.set(id, { context, exports: resolved });

            try {
                resolved.onEnable?.();
            } catch (e) {
                console.error(`[plugin:${id}] onEnable error:`, e);
            }

            this.injectContentScript(id, resolved);

            return true;
        } catch (error) {
            console.error(`Failed to activate plugin ${id}:`, error);
            return false;
        }
    }

    private deactivatePlugin(id: string): void {
        const runtime = this.runtimes.get(id);
        if (!runtime) return;

        try {
            runtime.exports.onDisable?.();
        } catch (e) {
            console.error(`[plugin:${id}] onDisable error:`, e);
        }

        this.removeContentScript(id);
        this.runtimes.delete(id);
    }

    /**
     * Plugin ids come from filenames, which the user controls. Restrict them to
     * characters that cannot terminate a JS string literal or an HTML attribute before
     * embedding them in injected source. Hyphens are excluded too, because the same
     * value is used to build the `__scrpc_cleanup_*` identifier.
     */
    private static safeId(id: string): string {
        return id.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    private injectContentScript(id: string, exports: PluginExports): void {
        if (!this.contentView) return;

        let code: string | undefined;
        try {
            code = exports.contentScript?.();
        } catch (e) {
            console.error(`[plugin:${id}] contentScript() error:`, e);
            return;
        }
        if (!code || !code.trim()) return;

        const safeId = PluginService.safeId(id);
        const escaped = code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        const wrapped = `
            (function(){
                try {
                    var existing = document.getElementById('scrpc-plugin-${safeId}');
                    if (existing) existing.remove();
                    var s = document.createElement('script');
                    s.id = 'scrpc-plugin-${safeId}';
                    s.textContent = \`${escaped}\`;
                    document.head.appendChild(s);
                } catch(e) { console.error('[plugin:${safeId}] inject error:', e); }
            })();
        `;

        this.contentView.webContents.executeJavaScript(wrapped).catch((e: Error) => {
            console.error(`[plugin:${id}] content script injection failed:`, e);
        });
    }

    private removeContentScript(id: string): void {
        if (!this.contentView) return;

        const safeId = PluginService.safeId(id);
        const cleanup = `
            (function(){
                var el = document.getElementById('scrpc-plugin-${safeId}');
                if (el) el.remove();
                if (window.__scrpc_cleanup_${safeId}) {
                    try { window.__scrpc_cleanup_${safeId}(); } catch(e) {}
                    delete window.__scrpc_cleanup_${safeId};
                }
            })();
        `;

        this.contentView.webContents.executeJavaScript(cleanup).catch(() => {});
    }

    public setContentView(view: BrowserView): void {
        this.contentView = view;
    }

    public injectAllContentScripts(): void {
        for (const [id, runtime] of this.runtimes) {
            this.injectContentScript(id, runtime.exports);
        }
    }

    private persistEnabledState(): void {
        // store the approved source hash rather than a bare flag, so the approval is
        // tied to specific file contents
        const map: Record<string, string> = {};
        for (const [id, plugin] of this.plugins) {
            if (plugin.enabled) map[id] = plugin.sourceHash;
        }
        this.store.set('enabledPlugins', map);
    }

    public setPluginEnabled(id: string, enabled: boolean): boolean {
        const plugin = this.plugins.get(id);
        if (!plugin) return false;

        plugin.enabled = enabled;
        this.persistEnabledState();

        if (enabled) {
            return this.activatePlugin(id);
        } else {
            this.deactivatePlugin(id);
            return true;
        }
    }

    public getPlugins(): PluginInfo[] {
        return Array.from(this.plugins.values());
    }

    public refreshPlugins(): void {
        for (const id of Array.from(this.runtimes.keys())) {
            this.deactivatePlugin(id);
        }

        this.plugins.clear();
        this.scanPlugins();

        // scanPlugins already resolved enabled state against the stored approvals, so a
        // file swapped in under a previously-enabled name comes back disabled. do not
        // re-enable by id here -- that would run whatever now sits at that filename.
        for (const [id, plugin] of this.plugins) {
            if (plugin.enabled) this.activatePlugin(id);
        }

        this.persistEnabledState();
        this.emitter.emit('plugins-changed');
    }

    public notifyTrackChange(track: Record<string, unknown>): void {
        for (const [id, runtime] of this.runtimes) {
            try {
                runtime.exports.onTrackChange?.({ ...track });
            } catch (e) {
                console.error(`[plugin:${id}] onTrackChange error:`, e);
            }
        }
    }

    public notifyThemeChange(isDark: boolean): void {
        for (const [id, runtime] of this.runtimes) {
            try {
                runtime.exports.onThemeChange?.(isDark);
            } catch (e) {
                console.error(`[plugin:${id}] onThemeChange error:`, e);
            }
        }
    }

    public getPluginsPath(): string {
        // route dev mode to workspace folder &&& production mode to user profile
        return app.isPackaged ? path.join(app.getPath('userData'), 'plugins') : path.join(process.cwd(), 'plugins');
    }

    public onPluginsChanged(listener: () => void): () => void {
        this.emitter.on('plugins-changed', listener);
        return () => this.emitter.off('plugins-changed', listener);
    }

    private setupIpcHandlers(): void {
        ipcMain.handle('get-plugins', () => {
            return this.getPlugins().map((p) => ({
                id: p.id,
                metadata: p.metadata,
                enabled: p.enabled,
            }));
        });

        ipcMain.handle('set-plugin-enabled', (_, id: string, enabled: boolean) => {
            return this.setPluginEnabled(id, enabled);
        });

        ipcMain.handle('get-plugins-folder-path', () => {
            return this.pluginsPath;
        });

        ipcMain.handle('refresh-plugins', () => {
            this.refreshPlugins();
            return this.getPlugins().map((p) => ({
                id: p.id,
                metadata: p.metadata,
                enabled: p.enabled,
            }));
        });
    }
}
