/** The lifecycle states of an order a buyer can follow in real time. */
export type OrderStatus = "pending" | "confirmed" | "paid" | "expired"

/** One push to a buyer's order status channel: what changed and when. */
export interface OrderStatusFrame {
    /** The order. */
    readonly orderId: string
    /** The state the order is in now. */
    readonly status: OrderStatus
    /** When the order entered that state, ISO 8601. */
    readonly changedAt: string
}
