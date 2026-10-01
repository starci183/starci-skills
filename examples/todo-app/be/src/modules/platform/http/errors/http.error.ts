import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the http capability: how an outbound call failed before an answer could be used. */
export enum HttpErrorCode {
    /** The other side did not answer within the deadline. */
    Timeout = "HTTP_TIMEOUT",
    /** The other side could not be reached. */
    Network = "HTTP_NETWORK",
    /** The other side answered with a body that is not JSON. */
    BodyUnreadable = "HTTP_BODY_UNREADABLE",
}

/** How each http code travels. */
export const HTTP_ERROR_KINDS: Record<HttpErrorCode, ErrorKind> = {
    [HttpErrorCode.Timeout]: "unavailable",
    [HttpErrorCode.Network]: "unavailable",
    [HttpErrorCode.BodyUnreadable]: "internal",
}

/** The one error class of the http capability. */
export class HttpError extends DomainError<HttpErrorCode> {}
