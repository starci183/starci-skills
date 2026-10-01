/** One request counted under a key of the rate limiter. */
export interface RateLimitHitParams {
    /** The counter: the tier and the caller address. */
    readonly key: string
    /** The length of the fixed window, in milliseconds. */
    readonly windowMs: number
}

/** One fixed window of the in-process counter the limiter falls back to while the shared store is unreachable. */
export interface LocalWindow {
    /** The requests counted in the window. */
    count: number
    /** When the window ends, epoch milliseconds. */
    resetAt: number
}
