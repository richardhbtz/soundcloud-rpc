import { shell, type WebContents } from 'electron';

interface NavigationPolicyOptions {
    /**
     * Third-party sign-in flows (Google, Apple, Facebook) genuinely need `window.open`,
     * so the content view allows popups. Every other view denies them outright.
     */
    allowPopups?: boolean;
}

/**
 * Without a window-open handler, any `window.open` or `target="_blank"` -- including one
 * from an embedded ad frame -- creates an app-owned window with no URL check and
 * whatever `webPreferences` the features string implies. Without a navigation guard, a
 * view can be driven to a non-web scheme.
 *
 * Popups that are allowed through are pinned to https and given an explicitly hardened
 * renderer, so a permitted popup can never be more privileged than the view that opened
 * it.
 */
export function applyNavigationPolicy(webContents: WebContents, options: NavigationPolicyOptions = {}): void {
    const { allowPopups = false } = options;

    webContents.setWindowOpenHandler(({ url }) => {
        const isHttps = /^https:\/\//i.test(url);

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
