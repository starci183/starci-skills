import type { Secret } from "@modules/platform/config"

/** Options of the cache integration. */
export interface CacheOptions {
    /** The Redis URL; it may embed credentials. */
    readonly url: Secret
    /** How long one Redis command waits for its answer before it fails as unavailable. */
    readonly timeoutMs: number
}
