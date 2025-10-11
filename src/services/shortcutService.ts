import { BrowserWindow, globalShortcut } from 'electron';

interface Shortcut {
    accelerator: string;
    action: () => void;
    description: string;
    enabled?: boolean;
}

export class ShortcutService {
    private shortcuts: Map<string, Shortcut> = new Map();
    private window: BrowserWindow | null = null;
    private registered: boolean = false;

    constructor(window?: BrowserWindow) {
        if (window) {
            this.window = window;
        }
    }

    setWindow(window: BrowserWindow) {
        this.window = window;
    }

    register(id: string, accelerator: string, description: string, action: () => void, enabled: boolean = true) {
        this.shortcuts.set(id, { accelerator, action, description, enabled });
    }

    unregister(id: string) {
        const shortcut = this.shortcuts.get(id);
        if (shortcut && this.registered) {
            globalShortcut.unregister(shortcut.accelerator);
        }
        this.shortcuts.delete(id);
    }

    setEnabled(id: string, enabled: boolean) {
        const shortcut = this.shortcuts.get(id);
        if (shortcut) {
            shortcut.enabled = enabled;
            if (this.registered) {
                this.refreshRegistrations();
            }
        }
    }

    setup() {
        if (this.registered) {
            this.unregisterAll();
        }

        for (const [id, shortcut] of this.shortcuts) {
            if (shortcut.enabled === false) continue;

            const success = globalShortcut.register(shortcut.accelerator, () => {
                if (!this.window || !this.window.isFocused()) return;

                try {
                    shortcut.action();
                } catch (error) {
                    console.error(`Error executing shortcut '${id}':`, error);
                }
            });

            if (!success) {
                console.warn(`Failed to register shortcut '${id}' (${shortcut.accelerator})`);
            }
        }

        this.registered = true;
    }

    private refreshRegistrations() {
        this.unregisterAll();
        this.setup();
    }

    private unregisterAll() {
        globalShortcut.unregisterAll();
        this.registered = false;
    }

    getShortcuts() {
        return Array.from(this.shortcuts.entries()).map(([id, shortcut]) => ({
            id,
            accelerator: shortcut.accelerator,
            description: shortcut.description,
            enabled: shortcut.enabled ?? true,
        }));
    }

    clear() {
        this.unregisterAll();
        this.shortcuts.clear();
    }

    get count(): number {
        return this.shortcuts.size;
    }

    destroy() {
        this.unregisterAll();
        this.shortcuts.clear();
        this.window = null;
    }
}
