import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the messaging capability. */
export enum MessagingErrorCode {
    /** A stored payload does not have the shape its queue declares. */
    PayloadInvalid = "MESSAGING_PAYLOAD_INVALID",
}

/** How each messaging code travels. */
export const MESSAGING_ERROR_KINDS: Record<MessagingErrorCode, ErrorKind> = {
    [MessagingErrorCode.PayloadInvalid]: "internal",
}

/** The one error class of the messaging capability. */
export class MessagingError extends DomainError<MessagingErrorCode> {}
