import type { CacheEntry, CachedValue, CacheRequest } from "./cache.contracts"

/** The cache port: typed entries declared by their owners, never free-form string keys. */
export interface Cache {
    /** The stored value, or null when the entry is absent or expired. */
    get<TValue>(request: CacheRequest<TValue>): Promise<CachedValue<TValue>>
    /** Stores `value` for the time the key declares. */
    set<TValue>(request: CacheEntry<TValue>): Promise<void>
    /** Removes the entry. */
    del(request: CacheRequest<unknown>): Promise<void>
}
