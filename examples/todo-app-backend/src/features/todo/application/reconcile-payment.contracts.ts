import type { PlanErrorCode } from "@modules/domain/plan"
import type { Outcome } from "@modules/platform/primitives"

/** What reconciling a payment takes: the intent the caller got back from upgradePlan. */
export interface ReconcilePaymentRequest {
    /** The payment intent id. */
    readonly paymentIntentId: string
}

/** What the gateway said and what it caused. */
export interface ReconciledPayment {
    /** The status the gateway reported just now: pending, paid or failed. */
    readonly gatewayStatus: string
    /** True when this call is the one that applied the intent; false when it is still pending or was applied or failed before. */
    readonly applied: boolean
    /** The status of the subscription afterwards. */
    readonly subscriptionStatus: string
}

/** What the gateway said, or the refusal that names why nothing was polled. */
export type ReconcilePaymentResult = Outcome<ReconciledPayment, PlanErrorCode>
