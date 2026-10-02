/** What recording the payment of an order takes: the delivery's event id and the paid order. */
export interface RecordOrderPaymentParams {
    /** The stable id of the delivered `billing.payment-confirmed` event; a repeat of it changes nothing. */
    readonly eventId: string
    /** The order a bank transfer paid. */
    readonly orderId: string
}

/** What expiring the overdue orders takes. */
export interface ExpireOverdueOrdersParams {
    /** Orders that have been pending for at least this long, in milliseconds, expire. */
    readonly olderThanMs: number
    /** The most orders one run expires, so a long backlog is worked off in bounded transactions. */
    readonly limit: number
}

/** How many orders one expiry run expired. */
export interface ExpireOverdueOrdersResult {
    /** The number of orders that moved from pending to expired. */
    readonly expired: number
}
