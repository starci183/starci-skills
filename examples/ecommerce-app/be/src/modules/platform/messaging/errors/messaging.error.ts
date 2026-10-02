import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the messaging capability. */
export enum MessagingErrorCode {
    /** The queue store could not be reached or did not answer in time. */
    Unavailable = "MESSAGING_UNAVAILABLE",
    /** A delivered payload does not have the shape its consumer reads. */
    PayloadInvalid = "MESSAGING_PAYLOAD_INVALID",
}

/** How each messaging code travels. */
export const MESSAGING_ERROR_KINDS: Record<MessagingErrorCode, ErrorKind> = {
    [MessagingErrorCode.Unavailable]: "unavailable",
    [MessagingErrorCode.PayloadInvalid]: "internal",
}

/** The one error class of the messaging capability. */
export class MessagingError extends DomainError<MessagingErrorCode> {}
