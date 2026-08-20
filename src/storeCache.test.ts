import { describe, expect, it } from 'vitest';
import { installStoreReadCache } from './utils/storeCache';

/** Minimal stand-in for electron-store that counts how often the file is read. */
function makeFakeStore(initial: Record<string, unknown> = {}) {
    const data: Record<string, unknown> = { ...initial };
    let reads = 0;

    const fake = {
        get(key: string, defaultValue?: unknown) {
            reads++;
            const value = key.includes('.')
                ? key.split('.').reduce<unknown>((acc, part) => (acc as any)?.[part], data)
                : data[key];
            return value === undefined ? defaultValue : value;
        },
        set(key: string, value: unknown) {
            data[key] = value;
        },
        delete(key: string) {
            delete data[key];
        },
        clear() {
            for (const key of Object.keys(data)) delete data[key];
        },
        get store() {
            reads++;
            return { ...data };
        },
        get readCount() {
            return reads;
        },
    };

    return fake;
}

describe('installStoreReadCache', () => {
    it('returns the same values as the underlying store', () => {
        const store = installStoreReadCache(makeFakeStore({ theme: 'dark', volume: 5 }));

        expect(store.get('theme')).toBe('dark');
        expect(store.get('volume')).toBe(5);
    });

    it('falls back to the default only when the key is absent', () => {
        const store = installStoreReadCache(makeFakeStore({ present: false }));

        expect(store.get('present', true)).toBe(false);
        expect(store.get('missing', 'fallback')).toBe('fallback');
        expect(store.get('missing')).toBeUndefined();
    });

    it('reads the config once across repeated gets', () => {
        const fake = makeFakeStore({ a: 1, b: 2 });
        const store = installStoreReadCache(fake);

        const before = fake.readCount;
        store.get('a');
        store.get('b');
        store.get('a');
        expect(fake.readCount - before).toBe(1);
    });

    it('reflects writes made through the store', () => {
        const store = installStoreReadCache(makeFakeStore({ theme: 'dark' }));

        expect(store.get('theme')).toBe('dark');
        store.set('theme', 'light');
        expect(store.get('theme')).toBe('light');
    });

    it('reflects deletes and clears', () => {
        const store = installStoreReadCache(makeFakeStore({ a: 1, b: 2 }));

        expect(store.get('a')).toBe(1);
        store.delete('a');
        expect(store.get('a')).toBeUndefined();

        expect(store.get('b')).toBe(2);
        store.clear();
        expect(store.get('b')).toBeUndefined();
    });

    it('delegates dot-path keys to the original implementation', () => {
        const store = installStoreReadCache(makeFakeStore({ proxy: { host: 'example.com' } }));

        expect(store.get('proxy.host')).toBe('example.com');
    });

    it('does not serve a stale value after a write invalidates the cache', () => {
        const store = installStoreReadCache(makeFakeStore({ count: 0 }));

        for (let i = 1; i <= 3; i++) {
            store.set('count', i);
            expect(store.get('count')).toBe(i);
        }
    });
});
