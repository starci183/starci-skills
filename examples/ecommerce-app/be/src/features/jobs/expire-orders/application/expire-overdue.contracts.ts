/** What one expiry sweep takes. */
export interface ExpireOverdueRequest {
    /** Orders pending for at least this long, in milliseconds, expire. */
    readonly olderThanMs: number
    /** The most orders the sweep expires. */
    readonly limit: number
}

/** The queue name: the contract between the scheduler of the sweep and the processor of the expire-orders job. */
export const ORDER_EXPIRY_QUEUE = "order-expiry"

/** The default time a pending order waits for its payment before it expires, in milliseconds. */
export const ORDER_PAYMENT_WINDOW_MS = 3_600_000

/** How the order expiry sweep runs: how often it ticks and how long an order waits for its payment. */
export interface OrderExpiryOptions {
    /** The pause between two ticks of the scheduler, in milliseconds. */
    readonly everyMs: number
    /** How long an order stays pending before it expires, in milliseconds. */
    readonly olderThanMs: number
}

/** The payload of one expire-orders job: orders pending for longer than this expire. */
export interface ExpireOrdersPayload {
    /** The payment window in milliseconds. */
    readonly olderThanMs: number
}
