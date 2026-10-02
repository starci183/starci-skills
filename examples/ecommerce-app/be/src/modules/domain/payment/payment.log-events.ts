/** Log events of the payment capability. */
export enum PaymentLogEvent {
    /** A transfer that is not money received was acknowledged and ignored; the notifier transfer id rides in the fields. */
    TransferIgnored = "payment.transfer.ignored",
    /** A transfer named an order with no open invoice (unknown, rejected or already paid) and was acknowledged; the code rides in the fields. */
    TransferUnmatched = "payment.transfer.unmatched",
}
