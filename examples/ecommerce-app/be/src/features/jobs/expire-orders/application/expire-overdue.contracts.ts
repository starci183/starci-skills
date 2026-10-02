/** What one expiry sweep takes. */
export interface ExpireOverdueRequest {
    /** Orders pending for at least this long, in milliseconds, expire. */
    readonly olderThanMs: number
    /** The most orders the sweep expires. */
    readonly limit: number
}
