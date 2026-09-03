import { join, normalize, sep } from 'path';

/**
 * Resolves an app-scheme asset request to a path inside that view's own directory.
 *
 * This is the only part of the protocol handler that takes attacker-shaped input, so it
 * lives on its own -- free of any Electron import -- and is unit tested directly. It
 * must never return a path outside `<rootDir>/<host>`.
 */
export function resolveAssetPath(rootDir: string, host: string, pathname: string): string | null {
    let decoded: string;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        // malformed percent-encoding; refuse rather than guess
        return null;
    }

    // a NUL byte can truncate the path at the syscall boundary on some platforms
    if (decoded.includes('\0')) return null;

    const relative = normalize(decoded).replace(/^([/\\]|\.\.[/\\])+/, '');
    const hostDir = join(rootDir, host);
    const filePath = join(hostDir, relative);

    // join() normalises again, so this catches anything the strip above missed
    return filePath === hostDir || filePath.startsWith(hostDir + sep) ? filePath : null;
}
