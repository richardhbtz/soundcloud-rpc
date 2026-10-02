import { protocol } from 'electron';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { resolveAssetPath } from './assetPath';

/**
 * The app's own views (settings, toasts, downloads, the homepage-confirm dialog) are served
 * over this scheme rather than as data: URLs. That gives each one a real origin, so its
 * script can live in a separate file and a strict CSP can be enforced.
 */
export const APP_SCHEME = 'scrpc';

type DocumentProvider = () => string;

const documentProviders = new Map<string, DocumentProvider>();

/**
 * Must run before `app.whenReady()`.
 *
 * `supportFetchAPI` stays off: with it on and `corsEnabled` off, a custom scheme allows
 * cross-origin reads (GHSA-v3j7-r9gq-3gjw), and these pages have nothing to fetch.
 */
export function registerAppScheme(): void {
    protocol.registerSchemesAsPrivileged([
        {
            scheme: APP_SCHEME,
            privileges: {
                standard: true,
                secure: true,
                supportFetchAPI: false,
                corsEnabled: false,
            },
        },
    ]);
}

/**
 * Registers the markup for one view host, e.g. 'settings'. The provider is called on
 * every load, so views that build their document from current settings keep working.
 */
export function provideDocument(host: string, provider: DocumentProvider): void {
    documentProviders.set(host, provider);
}

export function appUrl(host: string, path = '/'): string {
    return `${APP_SCHEME}://${host}${path}`;
}

/**
 * The policy every app-owned page is served with. Scripts come only from this scheme, never
 * inline, so a value that slips past escaping still cannot run; `connect-src 'none'` leaves
 * anything that did run with nowhere to send what it read.
 *
 * Styles keep 'unsafe-inline' because each view ships one inline <style> block. Custom theme
 * CSS goes through webContents.insertCSS(), which page CSP does not apply to.
 */
const CONTENT_SECURITY_POLICY = [
    "default-src 'none'",
    `script-src ${APP_SCHEME}:`,
    `style-src ${APP_SCHEME}: 'unsafe-inline'`,
    `img-src ${APP_SCHEME}: data: https:`,
    'font-src https: data:',
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
].join('; ');

const CONTENT_TYPES: Record<string, string> = {
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
};

function securityHeaders(contentType: string): HeadersInit {
    return {
        'Content-Type': contentType,
        'Content-Security-Policy': CONTENT_SECURITY_POLICY,
        'X-Content-Type-Options': 'nosniff',
    };
}

/** Must run after `app.whenReady()`. */
export function handleAppScheme(): void {
    // this module compiles to tsc/utils/, so the output root -- where the view scripts
    // are copied at build time -- is one level up
    const rootDir = join(__dirname, '..');

    protocol.handle(APP_SCHEME, async (request) => {
        let url: URL;
        try {
            url = new URL(request.url);
        } catch {
            return new Response('Bad request', { status: 400 });
        }

        const host = url.hostname;

        // the document itself
        if (url.pathname === '/' || url.pathname === '') {
            const provider = documentProviders.get(host);
            if (!provider) return new Response('Not found', { status: 404 });

            return new Response(provider(), {
                headers: securityHeaders('text/html; charset=utf-8'),
            });
        }

        // a static asset belonging to that view, confined to that view's directory so a
        // crafted request cannot walk out of the app bundle
        const filePath = resolveAssetPath(rootDir, host, url.pathname);
        if (!filePath) return new Response('Forbidden', { status: 403 });

        const extension = extname(filePath).toLowerCase();
        const contentType = CONTENT_TYPES[extension];
        if (!contentType) return new Response('Unsupported type', { status: 415 });

        try {
            const body = await readFile(filePath);
            return new Response(new Uint8Array(body), { headers: securityHeaders(contentType) });
        } catch {
            return new Response('Not found', { status: 404 });
        }
    });
}

/** The <meta> equivalent, for defence in depth if a page is ever loaded another way. */
export function cspMetaTag(): string {
    return `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY.replace(/"/g, '&quot;')}">`;
}
