import { readFileSync, statSync } from 'fs';
import * as path from 'path';

// Chromium sandboxes its child processes with either unprivileged user namespaces or a
// setuid `chrome-sandbox` helper, and refuses to start when it has neither. An AppImage
// is mounted nosuid so the helper can never be setuid inside one, and a few distros turn
// unprivileged namespaces off (Debian's kernel.unprivileged_userns_clone, Ubuntu 24.04's
// AppArmor rule), which leaves that combination aborting before the first window opens.
export interface SandboxProbe {
    readProcFlag(flagPath: string): string | null;
    hasSetuidSandboxHelper(): boolean;
}

const USER_NAMESPACE_FLAGS = [
    // Debian/Ubuntu kernels: 0 disables unprivileged user namespaces outright
    { flagPath: '/proc/sys/kernel/unprivileged_userns_clone', blockedValue: '0' },
    // upstream kernels: a quota of 0 means no namespace can be created
    { flagPath: '/proc/sys/user/max_user_namespaces', blockedValue: '0' },
    // Ubuntu 24.04+: AppArmor denies unprivileged namespaces to unconfined binaries
    { flagPath: '/proc/sys/kernel/apparmor_restrict_unprivileged_userns', blockedValue: '1' },
];

export function hasUnprivilegedUserNamespaces(probe: SandboxProbe): boolean {
    return !USER_NAMESPACE_FLAGS.some(({ flagPath, blockedValue }) => probe.readProcFlag(flagPath) === blockedValue);
}

export function isSandboxUsable(probe: SandboxProbe): boolean {
    return hasUnprivilegedUserNamespaces(probe) || probe.hasSetuidSandboxHelper();
}

export const systemSandboxProbe: SandboxProbe = {
    readProcFlag(flagPath: string): string | null {
        try {
            return readFileSync(flagPath, 'utf8').trim();
        } catch {
            return null;
        }
    },

    hasSetuidSandboxHelper(): boolean {
        try {
            const stats = statSync(path.join(path.dirname(process.execPath), 'chrome-sandbox'));
            return stats.uid === 0 && (stats.mode & 0o4000) !== 0;
        } catch {
            return false;
        }
    },
};
