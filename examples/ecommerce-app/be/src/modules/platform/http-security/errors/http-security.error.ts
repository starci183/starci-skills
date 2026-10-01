import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the http-security capability. */
export enum HttpSecurityErrorCode {
    /** A state-changing request came from an origin that is not on the allowlist. */
    OriginRejected = "HTTP_SECURITY_ORIGIN_REJECTED",
    /** The caller sent more requests than its tier allows in the current window. */
    RateLimited = "HTTP_SECURITY_RATE_LIMITED",
    /** The request body or arguments failed validation; the offending fields ride in the params. */
    RequestInvalid = "HTTP_SECURITY_REQUEST_INVALID",
}

/** How each http-security code travels. */
export const HTTP_SECURITY_ERROR_KINDS: Record<HttpSecurityErrorCode, ErrorKind> = {
    [HttpSecurityErrorCode.OriginRejected]: "forbidden",
    [HttpSecurityErrorCode.RateLimited]: "rate-limited",
    [HttpSecurityErrorCode.RequestInvalid]: "invalid",
}

/** The one error class of the http-security capability. */
export class HttpSecurityError extends DomainError<HttpSecurityErrorCode> {}
