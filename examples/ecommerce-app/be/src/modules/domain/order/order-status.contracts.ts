/** The lifecycle states of an order a buyer can follow in real time. */
export type OrderStatus = "pending" | "paid" | "expired" | "cancelled"

/** One push to a buyer's order status channel: what changed and when. */
export interface OrderStatusFrame {
    /** The order. */
    readonly orderId: string
    /** The state the order is in now. */
    readonly status: OrderStatus
    /** When the order entered that state, ISO 8601. */
    readonly changedAt: string
}

/** What pushing one status change to the order's buyer takes. */
export interface PushOrderStatusParams {
    /** The stable id of the delivered event; a repeat of it pushes nothing twice. */
    readonly eventId: string
    /** The buyer who owns the order and is the only one who can listen to its channel. */
    readonly personId: string
    /** The order. */
    readonly orderId: string
    /** The state the order is in now. */
    readonly status: OrderStatus
    /** When the order entered that state, ISO 8601. */
    readonly changedAt: string
}
