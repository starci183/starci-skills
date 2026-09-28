/** data.plan.payment-intent's own status field: pending, paid, or failed. */
export type PaymentIntentStatus = "pending" | "paid" | "failed";

/** data.plan.payment-intent: id is this product's own opaque id and the idempotency key
 * (br.plan.payment.idempotent); gatewayIntentId is SePay's own id for the same transaction. appliedAt is
 * set at most once per id - a payment intent is never deleted, it is the audit trail for a subscription's
 * activations. */
export class PaymentIntentRecord {
    constructor(
    readonly id: string,
    readonly subscriptionId: string,
    readonly gateway: string,
    readonly gatewayIntentId: string,
    readonly amount: number,
    readonly currency: string,
    public status: PaymentIntentStatus,
    public appliedAt: Date | null,
    ) {}
}
