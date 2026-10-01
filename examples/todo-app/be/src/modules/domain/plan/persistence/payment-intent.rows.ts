import type { PaymentIntentView } from "../plan.contracts"
import type { PaymentIntentEntity } from "./entities/payment-intent.entity"

/** Maps a payment intent row to the view callers get. */
export const toPaymentIntentView = (row: PaymentIntentEntity): PaymentIntentView => ({
    id: row.id,
    subscriptionId: row.subscriptionId,
    gateway: row.gateway,
    gatewayIntentId: row.gatewayIntentId,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    appliedAt: row.appliedAt,
})
