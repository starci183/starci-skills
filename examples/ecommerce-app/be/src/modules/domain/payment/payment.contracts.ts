/** A bank transfer notice as the payment intake takes it: what the notifier says about one transfer. */
export interface BankTransferNotice {
    /** The notifier id of this transfer; the inbox key, so a redelivery changes nothing. */
    readonly eventId: string
    /** The payment code the buyer wrote in the transfer: the id of the order it pays. */
    readonly code: string
    /** `in` is money received; only that can pay an invoice. */
    readonly transferType: "in" | "out"
    /** The transferred amount in minor units. */
    readonly transferAmount: number
    /** The bank reference of the transfer, kept on the payment record. */
    readonly referenceCode: string
}
