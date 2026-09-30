import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the notify capability. */
export enum NotifyErrorCode {
    /** The channel is blank. */
    ChannelRequired = "NOTIFY_CHANNEL_REQUIRED",
    /** The digest window is not a whole number of minutes of at least one. */
    DigestWindowInvalid = "NOTIFY_DIGEST_WINDOW_INVALID",
}

/** How each notify code travels. */
export const NOTIFY_ERROR_KINDS: Record<NotifyErrorCode, ErrorKind> = {
    [NotifyErrorCode.ChannelRequired]: "invalid",
    [NotifyErrorCode.DigestWindowInvalid]: "invalid",
}

/** The one error class of the notify capability. */
export class NotifyError extends DomainError<NotifyErrorCode> {}
