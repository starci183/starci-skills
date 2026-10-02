/** The confirmation the order service answers for a placed - or idempotently replayed - order. */
export type OrderConfirmation = {
    readonly orderId: string
    readonly status: string
    readonly totalMinorUnits: number
    readonly currency: string
    readonly replayed: boolean
}

/** A time-limited download link of an order's receipt. */
export type ReceiptLink = {
    readonly url: string
    readonly expiresAt: string
}

/**
 * There is deliberately no order-list type here: the backend's only order read surfaces are the
 * confirmation above and the `hasOrders` flag the identity `account` query joins. An account page
 * that listed orders would have no door to read them through.
 */
