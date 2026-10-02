/** What recording the payment of an order takes. */
export interface RecordOrderPaymentRequest {
    /** The id of the delivered event; the inbox claim and the dedupe of a redelivery are built on it. */
    readonly eventId: string
    /** The order a bank transfer paid. */
    readonly orderId: string
}

/** The command answers nothing: its effect is the state the domain service wrote. */
export type RecordOrderPaymentResult = void
