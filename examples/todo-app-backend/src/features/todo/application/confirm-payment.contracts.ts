import type { PlanErrorCode } from "@modules/domain/plan"
import type { Outcome } from "@modules/platform/primitives"

/** What the gateway reports for one payment intent. */
export interface ConfirmPaymentRequest {
    /** The id the gateway knows the transaction under. */
    readonly gatewayIntentId: string
    /** What the gateway reported. */
    readonly outcome: "paid" | "failed"
    /** The end of the paid period, absent for the default period; meaningful only when the outcome is paid. */
    readonly periodEnd?: Date
}

/** What the confirmation changed. */
export interface ConfirmedPayment {
    /** True when this call activated the subscription; false for a replay, a failure or an already applied intent. */
    readonly applied: boolean
    /** The status of the subscription afterwards. */
    readonly subscriptionStatus: string
}

/** What was applied, or the refusal that names the unknown intent. */
export type ConfirmPaymentResult = Outcome<ConfirmedPayment, PlanErrorCode>
