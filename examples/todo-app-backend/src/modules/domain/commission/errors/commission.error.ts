import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the commission capability, also the refusals of its operations. */
export enum CommissionErrorCode {
    /** A person cannot earn a commission on their own payment. */
    SelfReferral = "COMMISSION_SELF_REFERRAL",
}

/** How each commission code travels. */
export const COMMISSION_ERROR_KINDS: Record<CommissionErrorCode, ErrorKind> = {
    [CommissionErrorCode.SelfReferral]: "invalid",
}

/** The one error class of the commission capability. */
export class CommissionError extends DomainError<CommissionErrorCode> {}
