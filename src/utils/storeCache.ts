/**
 * electron-store re-reads, re-parses and (with an `encryptionKey`) re-decrypts the config
 * file on every get(), and settings are read on hot paths: per track update, per theme
 * application, per window resize.
 *
 * This keeps the parsed config in memory and drops it on any write through the same
 * instance. Only plain top-level string keys are served from the cache; dot-paths and
 * anything else go to the original implementation.
 */

interface CacheableStore {
    get(key: string, defaultValue?: unknown): unknown;
    set(...args: unknown[]): void;
    delete(key: string): void;
    clear(): void;
    store: Record<string, unknown>;
}

export function installStoreReadCache<T extends CacheableStore>(store: T): T {
    let cache: Record<string, unknown> | null = null;

    const originalGet = store.get.bind(store);
    const originalSet = store.set.bind(store);
    const originalDelete = store.delete.bind(store);
    const originalClear = store.clear.bind(store);

    const invalidate = (): void => {
        cache = null;
    };

    const readAll = (): Record<string, unknown> => {
        if (cache === null) cache = { ...store.store };
        return cache;
    };

    store.get = (key: string, defaultValue?: unknown): unknown => {
        if (typeof key !== 'string' || key.includes('.')) {
            return originalGet(key, defaultValue);
        }

        const all = readAll();
        const value = all[key];
        return value === undefined ? defaultValue : value;
    };

    store.set = (...args: unknown[]): void => {
        invalidate();
        originalSet(...args);
    };

    store.delete = (key: string): void => {
        invalidate();
        originalDelete(key);
    };

    store.clear = (): void => {
        invalidate();
        originalClear();
    };

    return store;
}
