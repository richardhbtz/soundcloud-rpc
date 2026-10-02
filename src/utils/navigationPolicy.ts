import { shell, type WebContents } from 'electron';

interface NavigationPolicyOptions {
    /** Tabs need `window.open` for third-party sign-in (Google, Apple, Facebook); no other view does. */
    allowPopups?: boolean;
    /**
     * Called instead of opening a window when the user opens a soundcloud.com link in a new tab
     * (cmd/ctrl/middle click, or a target="_blank" link).
     */
    onNewTab?: (url: string, background: boolean) => void;
}

/**
 * Left alone, any `window.open` or `target="_blank"` -- including one from an ad frame --
 * creates an app-owned window with no URL check, and a view can be navigated to a non-web
 * scheme. Popups that are allowed are held to https and a hardened renderer, so one can
 * never be more privileged than the view that opened it.
 */
export function applyNavigationPolicy(webContents: WebContents, options: NavigationPolicyOptions = {}): void {
    const { allowPopups = false, onNewTab } = options;

    webContents.setWindowOpenHandler(({ url, disposition }) => {
        const isHttps = /^https:\/\//i.test(url);
        const wantsTab = disposition === 'foreground-tab' || disposition === 'background-tab';

        if (onNewTab && wantsTab && /^https:\/\/soundcloud\.com(\/|$)/i.test(url)) {
            onNewTab(url, disposition === 'background-tab');
            return { action: 'deny' };
        }

        if (allowPopups && isHttps) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        sandbox: true,
                        webSecurity: true,
                        allowRunningInsecureContent: false,
                        nodeIntegrationInSubFrames: false,
                        nodeIntegrationInWorker: false,
                    },
                },
            };
        }

        // hand plain links to the user's browser rather than opening them in-app
        if (isHttps) void shell.openExternal(url);
        return { action: 'deny' };
    });

    webContents.on('will-navigate', (event, url) => {
        if (/^https?:\/\//i.test(url)) return;

        // file:, javascript:, and OS protocol handlers are not navigations the page
        // should be able to force
        event.preventDefault();
        console.warn('Blocked navigation to non-web URL:', url);
    });
}
