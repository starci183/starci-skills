import type { OrderStatus } from "@modules/domain/order"

/** What pushing the status of an order takes. */
export interface PushOrderStatusRequest {
    /** The id of the delivered event; the inbox claim and the dedupe of a redelivery are built on it. */
    readonly eventId: string
    /** The buyer who owns the order. */
    readonly personId: string
    /** The order. */
    readonly orderId: string
    /** The state the order is in now. */
    readonly status: OrderStatus
    /** When the order entered that state, ISO 8601. */
    readonly changedAt: string
}

/** The command answers nothing: its effect is the state the domain service wrote. */
export type PushOrderStatusResult = void
