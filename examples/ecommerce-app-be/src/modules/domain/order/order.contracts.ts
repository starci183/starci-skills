import type { EntityManager } from "typeorm"

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
    /** The lifecycle state. */
    readonly status: "confirmed"
    /** The order total in minor units. */
    readonly totalMinorUnits: number
    /** The currency. */
    readonly currency: "USD"
    /** The captured payment. */
    readonly paymentId: string
    /** True when this answer replays an earlier confirmation with the same key. */
    readonly replayed: boolean
}

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

/** What reading a buyer status needs. */
export interface BuyerStatusParams {
    /** The person. */
    readonly personId: string
}
