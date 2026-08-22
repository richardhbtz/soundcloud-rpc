import { describe, it, expect } from 'vitest';
import { hasUnprivilegedUserNamespaces, isSandboxUsable, type SandboxProbe } from './sandbox';

const USERNS_CLONE = '/proc/sys/kernel/unprivileged_userns_clone';
const MAX_USER_NAMESPACES = '/proc/sys/user/max_user_namespaces';
const APPARMOR_RESTRICT = '/proc/sys/kernel/apparmor_restrict_unprivileged_userns';

function probe(flags: Record<string, string>, hasSetuidSandboxHelper = false): SandboxProbe {
    return {
        readProcFlag: (flagPath: string) => flags[flagPath] ?? null,
        hasSetuidSandboxHelper: () => hasSetuidSandboxHelper,
    };
}

describe('hasUnprivilegedUserNamespaces', () => {
    it('assumes namespaces work when no kernel exposes any of the flags', () => {
        expect(hasUnprivilegedUserNamespaces(probe({}))).toBe(true);
    });

    it('reads permissive flag values as available', () => {
        const flags = { [USERNS_CLONE]: '1', [MAX_USER_NAMESPACES]: '127435', [APPARMOR_RESTRICT]: '0' };
        expect(hasUnprivilegedUserNamespaces(probe(flags))).toBe(true);
    });

    it('detects namespaces disabled on Debian-style kernels', () => {
        expect(hasUnprivilegedUserNamespaces(probe({ [USERNS_CLONE]: '0' }))).toBe(false);
    });

    it('detects a zero namespace quota', () => {
        expect(hasUnprivilegedUserNamespaces(probe({ [MAX_USER_NAMESPACES]: '0' }))).toBe(false);
    });

    it("detects Ubuntu 24.04's AppArmor restriction", () => {
        expect(hasUnprivilegedUserNamespaces(probe({ [APPARMOR_RESTRICT]: '1' }))).toBe(false);
    });

    it('ignores trailing whitespace already trimmed by the probe', () => {
        expect(hasUnprivilegedUserNamespaces(probe({ [MAX_USER_NAMESPACES]: '1' }))).toBe(true);
    });
});

describe('isSandboxUsable', () => {
    it('is usable when unprivileged namespaces are available', () => {
        expect(isSandboxUsable(probe({}))).toBe(true);
    });

    it('is usable through the setuid helper when namespaces are blocked', () => {
        expect(isSandboxUsable(probe({ [USERNS_CLONE]: '0' }, true))).toBe(true);
    });

    it('is unusable when namespaces are blocked and no setuid helper exists', () => {
        expect(isSandboxUsable(probe({ [USERNS_CLONE]: '0' }, false))).toBe(false);
    });

    it('is unusable inside an AppImage on an AppArmor-restricted host', () => {
        expect(isSandboxUsable(probe({ [APPARMOR_RESTRICT]: '1' }, false))).toBe(false);
    });
});
