import type { OrderErrorCode, PlacedOrder } from "@modules/domain/order"
import type { Outcome } from "@modules/platform/primitives"

/** What confirming an order takes: an optional replay key. */
export interface PlaceOrderRequest {
    /** The replay key: repeating a confirmation with the same key returns the first answer instead of a second order. */
    readonly idempotencyKey?: string
}

/** The confirmed order, or the refusal that names why the cart cannot be confirmed. */
export type PlaceOrderResult = Outcome<PlacedOrder, OrderErrorCode>
