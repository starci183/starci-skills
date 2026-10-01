import type { PlanErrorCode } from "@modules/domain/plan"
import type { Outcome } from "@modules/platform/primitives"

/** What one signed delivery of the gateway carries: the presented credential and what the gateway reported. */
export interface ConfirmPaymentRequest {
    /** The Authorization header as presented, absent when the sender sent none. */
    readonly authorization: string | undefined
    /** The id the gateway knows the transaction under. */
    readonly gatewayIntentId: string
    /** What the gateway reported. */
    readonly outcome: "paid" | "failed"
    /** The end of the paid period, absent for the default period; meaningful only when the outcome is paid. */
    readonly periodEnd?: Date
}

/** What the delivery caused: ignored, or what the confirmation changed. */
export type ConfirmedPayment =
    | { readonly ignored: true }
    | {
          /** False: the delivery was authorized and applied. */
          readonly ignored: false
          /** True when this call activated the subscription; false for a replay, a failure or an already applied intent. */
          readonly applied: boolean
          /** The status of the subscription afterwards. */
          readonly subscriptionStatus: string
      }

/** What was applied or ignored, or the refusal that names the unknown intent. */
export type ConfirmPaymentResult = Outcome<ConfirmedPayment, PlanErrorCode>
