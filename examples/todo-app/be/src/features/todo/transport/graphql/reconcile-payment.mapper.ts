import type { ReconcilePaymentRequest, ReconciledPayment } from "../../application/reconcile-payment.contracts"
import type { ReconcilePaymentInput } from "./dto/reconcile-payment.input"
import type { ReconcilePaymentType } from "./dto/reconcile-payment.type"

/** Maps the GraphQL input to the command request. */
export const toReconcilePaymentRequest = (input: ReconcilePaymentInput): ReconcilePaymentRequest => ({
    paymentIntentId: input.paymentIntentId,
})

/** Maps the reconciled payment to the GraphQL type. */
export const toReconcilePaymentType = (reconciled: ReconciledPayment): ReconcilePaymentType => ({
    gatewayStatus: reconciled.gatewayStatus,
    applied: reconciled.applied,
    subscriptionStatus: reconciled.subscriptionStatus,
})
