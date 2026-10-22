import type { CacheKey, CacheRequest } from "./cache.contracts"

/** Declares a cache key; the owner keeps every key it caches in its own `<owner>.cache-keys.ts`. */
export const defineCacheKey = <TValue>(key: CacheKey<TValue>): CacheKey<TValue> => key

/** The store key text of one entry: the key name followed by its arguments. */
export const cacheKeyText = (request: CacheRequest<unknown>): string => [request.key.name, ...request.args].join(":")
