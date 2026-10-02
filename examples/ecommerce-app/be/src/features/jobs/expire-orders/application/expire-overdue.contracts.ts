/** What one expiry sweep takes: the raw payload of the job tick, read by the order payment service. */
export interface ExpireOverdueRequest {
    /** The payload the scheduler wrote on the job, as delivered. */
    readonly payload: object
}
