import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the plan capability, also the refusals of the plan operations. */
export enum PlanErrorCode {
    /** The subscription or the payment intent belongs to somebody else. */
    Forbidden = "PLAN_FORBIDDEN",
    /** The payment intent does not exist. */
    PaymentIntentNotFound = "PLAN_PAYMENT_INTENT_NOT_FOUND",
    /** The subscription does not exist. */
    SubscriptionNotFound = "PLAN_SUBSCRIPTION_NOT_FOUND",
}

/** How each plan code travels. */
export const PLAN_ERROR_KINDS: Record<PlanErrorCode, ErrorKind> = {
    [PlanErrorCode.Forbidden]: "forbidden",
    [PlanErrorCode.PaymentIntentNotFound]: "not-found",
    [PlanErrorCode.SubscriptionNotFound]: "not-found",
}

/** The one error class of the plan capability. */
export class PlanError extends DomainError<PlanErrorCode> {}
