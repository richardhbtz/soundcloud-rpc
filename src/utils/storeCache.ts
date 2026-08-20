/**
 * electron-store (conf) re-reads and re-parses the config file on every get(), and this
 * app opens the store with an `encryptionKey`, so each read also runs a decrypt. Settings
 * are read on hot paths -- per track update, per theme application, per window resize --
 * where the same handful of keys is fetched repeatedly.
 *
 * This caches the parsed config in memory and drops the cache on any write through the
 * same instance.
 *
 * Deliberately conservative: anything other than a plain top-level string key is handed
 * straight to the original implementation, so dot-paths, symbol access and the rest keep
 * electron-store's exact semantics.
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
        // `store` is conf's own getter: one file read plus one decrypt, then reused
        // until the next write
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
