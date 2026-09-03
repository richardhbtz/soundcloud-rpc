import { protocol } from 'electron';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { resolveAssetPath } from './assetPath';

/**
 * Privileged views (settings, notifications, the homepage-confirm dialog) used to load
 * as `data:text/html,...`. A data: URL has an opaque origin and no way to reference an
 * external file, which forced every script inline and made a Content-Security-Policy
 * pointless -- the pages ran with no CSP at all, in renderers holding the app's most
 * privileged preloads.
 *
 * Serving them over an app-owned scheme instead gives each view a real origin, lets its
 * script live in a separate file, and makes a strict CSP enforceable.
 */
export const APP_SCHEME = 'scrpc';

type DocumentProvider = () => string;

const documentProviders = new Map<string, DocumentProvider>();

/**
 * Must run before `app.whenReady()`.
 *
 * Deliberately does NOT set `supportFetchAPI`. A custom scheme registered with fetch
 * support but without `corsEnabled` allows cross-origin reads
 * (GHSA-v3j7-r9gq-3gjw); these pages have no need to fetch, and the CSP below blocks
 * `connect-src` anyway.
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
 * The policy every app-owned page is served with.
 *
 * `default-src 'none'` means anything not named below is refused. Scripts come only from
 * this scheme -- never inline, so a value that escapes its escaping still cannot execute.
 * `connect-src 'none'` is the important one for containment: even if something did run,
 * it has nowhere to send what it read.
 *
 * Styles keep 'unsafe-inline' because each view ships one inline <style> block. That is a
 * far weaker concession than inline script, and custom theme CSS is applied through
 * webContents.insertCSS(), which is not subject to page CSP.
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
