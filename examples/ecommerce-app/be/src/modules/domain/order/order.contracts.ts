import type { EntityManager } from "typeorm"
import type { CartLine } from "@modules/domain/cart"
import type { ProductView } from "@modules/domain/catalog"

/** One priced line of a checkout plan: the catalog unit price captured at evaluation time. */
export interface CheckoutLine {
    /** The SKU. */
    readonly productId: string
    /** How many units. */
    readonly quantity: number
    /** The unit price in minor units. */
    readonly unitPriceMinorUnits: number
}

/** What a cart evaluates to when it can be confirmed: every line priced and one total. */
export interface CheckoutPlan {
    /** The priced lines. */
    readonly lines: ReadonlyArray<CheckoutLine>
    /** The order total in minor units. */
    readonly totalMinorUnits: number
    /** The currency; this example sells in USD only. */
    readonly currency: "USD"
}

/** A confirmed order as the doors answer it. */
export interface PlacedOrder {
    /** The order id. */
    readonly orderId: string
    /** The lifecycle state: an order that confirmed and was later cancelled keeps answering as a replay with `cancelled`. */
    readonly status: "confirmed" | "cancelled"
    /** The order total in minor units. */
    readonly totalMinorUnits: number
    /** The currency. */
    readonly currency: "USD"
    /** The captured payment. */
    readonly paymentId: string
    /** True when this answer replays an earlier confirmation with the same key. */
    readonly replayed: boolean
}

/** One line of a receipt. */
export interface ReceiptLine {
    /** The product. */
    readonly productId: string
    /** How many. */
    readonly quantity: number
    /** The unit price paid, in minor units. */
    readonly unitPriceMinorUnits: number
}

/** The receipt document an order archives: what was bought, for how much, paid by which payment, and when. */
export interface ReceiptDocument {
    /** The order. */
    readonly orderId: string
    /** The buyer. */
    readonly personId: string
    /** The lines, by product. */
    readonly lines: ReadonlyArray<ReceiptLine>
    /** The total in minor units. */
    readonly totalMinorUnits: number
    /** The currency. */
    readonly currency: string
    /** The captured payment. */
    readonly paymentId: string
    /** When the order was placed, ISO 8601. */
    readonly placedAt: string
}

/** Which receipt a buyer asks for. */
export interface ReceiptLinkParams {
    /** The buyer asking. */
    readonly personId: string
    /** Their order. */
    readonly orderId: string
}

/** The object key of an archived receipt, or null when the archive could not take it. */
export type ArchivedReceiptKey = string | null

/** Whether a person has confirmed orders. */
export interface GetBuyerStatusResult {
    /** The person. */
    readonly personId: string
    /** True when at least one order is confirmed. */
    readonly hasOrders: boolean
}

/** The earlier confirmation with the same key, or null when there is none. */
export type FindPlacedOrderResult = PlacedOrder | null

/** What looking up an earlier confirmation needs. */
export interface FindPlacedOrderParams {
    /** The buyer. */
    readonly personId: string
    /** The replay key. */
    readonly idempotencyKey: string
    /** The manager to read with, when the read must see the caller transaction. */
    readonly manager?: EntityManager
}

/** What confirming an order needs; every write joins the caller transaction. */
export interface PlaceOrderParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The buyer. */
    readonly personId: string
    /** The evaluated cart. */
    readonly plan: CheckoutPlan
    /** The replay key, when the client sent one. */
    readonly idempotencyKey?: string
}

/** What confirming the cart of a person needs. */
export interface PlaceOrderRequest {
    /** The buyer. */
    readonly personId: string
    /** The replay key, when the client sent one: repeating a confirmation with it returns the first order. */
    readonly idempotencyKey?: string
}

/** What reading a buyer status needs. */
export interface BuyerStatusParams {
    /** The person. */
    readonly personId: string
}

/** What reading the cart view of a person needs. */
export interface ViewCartParams {
    /** The cart owner. */
    readonly personId: string
}

/** The cart of a person and the catalog it prices against. */
export interface CartView {
    /** The lines of the cart. */
    readonly items: ReadonlyArray<CartLine>
    /** The catalog products. */
    readonly catalog: ReadonlyArray<ProductView>
}

/** What adding to the cart of a person needs. */
export interface AddToCartParams {
    /** The cart owner. */
    readonly personId: string
    /** The SKU. */
    readonly productId: string
    /** How many units to add. */
    readonly quantity: number
}

/** What emptying the cart of a person needs. */
export interface EmptyCartParams {
    /** The cart owner. */
    readonly personId: string
}

/** The confirmation that a cart is empty now. */
export interface EmptiedCart {
    /** Always true. */
    readonly cleared: true
}

/** The saga that orchestrates an order from its placement to its invoice: the name of `place-order.saga.ts` of the checkout feature. */
export const PLACE_ORDER_SAGA = "place-order"

/** What cancelling an order takes. */
export interface CancelOrderParams {
    /** The order to cancel. */
    readonly orderId: string
}

/** How a cancellation ended: `cancelled` is false when the order was already cancelled or is unknown and nothing changed. */
export interface CancelledOrder {
    /** The order. */
    readonly orderId: string
    /** Whether this call cancelled it. */
    readonly cancelled: boolean
}
