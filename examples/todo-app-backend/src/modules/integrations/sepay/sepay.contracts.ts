/** What creating a payment intent at the gateway needs. */
export interface SepayCreateIntentParams {
    /** The reference the gateway echoes back: the id of the subscription that is paid for. */
    readonly subscriptionId: string
    /** The amount in minor units of the currency. */
    readonly amount: number
    /** The currency. */
    readonly currency: string
}

/** The intent the gateway created. */
export interface SepayCreateIntentResult {
    /** The id the gateway knows the transaction under. */
    readonly gatewayIntentId: string
    /** Where the owner completes the payment. */
    readonly checkoutUrl: string
}

/** The closed vocabulary of a gateway transaction status. */
export type SepayTransactionStatus = "pending" | "paid" | "failed"

/** A transaction as the gateway reports it right now. */
export interface SepayTransaction {
    /** The status of the transaction. */
    readonly status: SepayTransactionStatus
    /** The end of the paid period, present only when the gateway named one. */
    readonly periodEnd: Date | undefined
}

/** The operations the client names in its failures. */
export type SepayOperation = "create-intent" | "get-transaction"
