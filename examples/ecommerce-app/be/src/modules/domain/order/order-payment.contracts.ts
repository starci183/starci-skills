/** What recording the payment of an order takes: the delivery's event id and the paid order. */
export interface RecordOrderPaymentParams {
    /** The stable id of the delivered `billing.payment-confirmed` event; a repeat of it changes nothing. */
    readonly eventId: string
    /** The order a bank transfer paid. */
    readonly orderId: string
}

/** What expiring the overdue orders takes: the raw payload of the expire-orders job tick. */
export interface ExpireOverdueOrdersParams {
    /** The payload the scheduler wrote on the job; an `olderThanMs` number on it is the payment window, anything else gets the default. */
    readonly payload: object
}

/** How many orders one expiry run expired. */
export interface ExpireOverdueOrdersResult {
    /** The number of orders that moved from pending to expired. */
    readonly expired: number
}
