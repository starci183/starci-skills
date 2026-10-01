import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the notify-smtp integration. */
export enum NotifySmtpErrorCode {
    /** The mail host permanently refused the recipient address (a 5xx answer to RCPT TO); retrying cannot help. */
    PermanentRejection = "NOTIFY_SMTP_PERMANENT_REJECTION",
    /** The mail host could not be reached, went silent, or answered with a temporary refusal; a retry may work. */
    TransientFailure = "NOTIFY_SMTP_TRANSIENT_FAILURE",
}

/** How each notify-smtp code travels. */
export const NOTIFY_SMTP_ERROR_KINDS: Record<NotifySmtpErrorCode, ErrorKind> = {
    [NotifySmtpErrorCode.PermanentRejection]: "invalid",
    [NotifySmtpErrorCode.TransientFailure]: "unavailable",
}

/** The one error class of the notify-smtp integration. */
export class NotifySmtpError extends DomainError<NotifySmtpErrorCode> {}
