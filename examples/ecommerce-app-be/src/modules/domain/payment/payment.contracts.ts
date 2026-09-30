import type { EntityManager } from "typeorm"

/** The captured-payment view a confirmation returns: the ledger row id and the amount. */
export interface PaymentView {
    /** The payment id. */
    readonly paymentId: string
    /** The captured amount in minor units. */
    readonly amountMinorUnits: number
}

/** What capturing a payment needs; the write joins the caller transaction. */
export interface CapturePaymentParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The paying person. */
    readonly personId: string
    /** The order the payment settles. */
    readonly orderId: string
    /** The amount in minor units. */
    readonly amountMinorUnits: number
}

/** What looking a payment up by order needs. */
export interface FindPaymentParams {
    /** The order the payment settles. */
    readonly orderId: string
    /** The manager to read with, when the read must see the caller transaction. */
    readonly manager?: EntityManager
}
