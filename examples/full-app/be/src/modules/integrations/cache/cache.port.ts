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

/** The options the module hands the factory when it builds the Redis driver of the app. */
export interface RedisDriverOptions {
    /** Open the connection on the first command, not at construction. */
    readonly lazyConnect: boolean
    /** How many times a command is retried per request. */
    readonly maxRetriesPerRequest: number | null
    /** How long a command may take, in milliseconds. */
    readonly commandTimeout: number
}

/** The store connection as the client uses it: the minimal shape of the library object, so the client never imports it. */
export interface RedisDriver {
    /** The connection state the client reads: `"wait"` before the first command. */
    readonly status: string
    /** Opens the connection. */
    connect(): Promise<void>
    /** The stored text of the key, or null when absent. */
    get(key: string): Promise<string | null>
    /** Stores the text of the key with a ttl in whole seconds. */
    set(key: string, value: string, expiryMode: "EX", ttl: number): Promise<unknown>
    /** Removes the key. */
    del(key: string): Promise<unknown>
    /** Resolves when the store answers. */
    ping(): Promise<unknown>
    /** Closes the connection. */
    quit(): Promise<unknown>
}

/** Builds the Redis driver; the module provides it so a spec can double it through the injection token. */
export interface RedisFactory {
    /** The driver over the url with the options. */
    create(url: string, options: RedisDriverOptions): RedisDriver
}
