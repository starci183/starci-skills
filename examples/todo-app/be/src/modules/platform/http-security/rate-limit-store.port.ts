import type { RateLimitHitParams } from "./http-security.contracts"

/**
 * The shared counter of the rate limiter: one fixed window per key, counted where every replica of the app counts (Redis),
 * so a caller gets the declared limit across all replicas, not once per replica. An integration provides it.
 */
export interface RateLimitStore {
    /** Counts one request under `key` in the window it falls in and answers the count of that window so far. */
    hit(params: RateLimitHitParams): Promise<number>
}
