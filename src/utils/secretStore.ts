import { safeStorage } from 'electron';
import type ElectronStore from 'electron-store';

/**
 * electron-store is opened with an `encryptionKey` that is a string literal in this
 * repository's source, so it is obfuscation against casual file editing rather than
 * protection. Anything that can read the config file can recover that key.
 *
 * Credentials therefore go through the OS-backed keystore instead -- Keychain on macOS,
 * DPAPI on Windows, libsecret/kwallet on Linux -- and are held in the config file only
 * as ciphertext.
 */

const ENCRYPTED_PREFIX = 'enc.v1:';

export const SECRET_KEYS = ['lastFmApiKey', 'lastFmSecret', 'lastFmSessionKey', 'proxyData'] as const;

export type SecretKey = (typeof SECRET_KEYS)[number];

export function isSecretKey(key: string): key is SecretKey {
    return (SECRET_KEYS as readonly string[]).includes(key);
}

function encryptionAvailable(): boolean {
    try {
        return safeStorage.isEncryptionAvailable();
    } catch {
        return false;
    }
}

let warnedUnavailable = false;
function warnUnavailableOnce(): void {
    if (warnedUnavailable) return;
    warnedUnavailable = true;
    console.warn(
        'OS-backed encryption is unavailable, so credentials are stored without it. ' +
            'On Linux this usually means no keyring (libsecret or kwallet) is running.',
    );
}

/**
 * Read a secret. Values written by older builds are plain and are returned as-is, so
 * upgrading never loses a saved credential.
 */
export function readSecret<T>(store: ElectronStore, key: SecretKey, fallback: T): T {
    const raw = store.get(key);

    if (typeof raw !== 'string' || !raw.startsWith(ENCRYPTED_PREFIX)) {
        return raw === undefined ? fallback : (raw as T);
    }

    if (!encryptionAvailable()) {
        warnUnavailableOnce();
        return fallback;
    }

    try {
        const buffer = Buffer.from(raw.slice(ENCRYPTED_PREFIX.length), 'base64');
        return JSON.parse(safeStorage.decryptString(buffer)) as T;
    } catch (error) {
        // usually means the OS keystore entry was rotated or the profile was copied
        // between machines; treat it as unset rather than crashing
        console.error(`Failed to decrypt "${key}"; treating it as unset.`, error);
        return fallback;
    }
}

export function writeSecret(store: ElectronStore, key: SecretKey, value: unknown): void {
    if (value === undefined || value === null || value === '') {
        store.set(key, '');
        return;
    }

    if (!encryptionAvailable()) {
        warnUnavailableOnce();
        store.set(key, value);
        return;
    }

    try {
        const encrypted = safeStorage.encryptString(JSON.stringify(value));
        store.set(key, ENCRYPTED_PREFIX + encrypted.toString('base64'));
    } catch (error) {
        console.error(`Failed to encrypt "${key}"; storing it without OS encryption.`, error);
        store.set(key, value);
    }
}

/**
 * Re-write any plaintext secret through the OS keystore. Must run after `app.whenReady`.
 * Safe to call repeatedly -- already-encrypted values are left alone.
 */
export function migrateSecrets(store: ElectronStore): void {
    if (!encryptionAvailable()) {
        warnUnavailableOnce();
        return;
    }

    for (const key of SECRET_KEYS) {
        const raw = store.get(key);
        if (raw === undefined || raw === '') continue;
        if (typeof raw === 'string' && raw.startsWith(ENCRYPTED_PREFIX)) continue;
        writeSecret(store, key, raw);
    }
}
