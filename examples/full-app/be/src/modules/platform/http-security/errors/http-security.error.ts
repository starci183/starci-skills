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
    /** A webhook delivery did not carry a valid signature of its exact body. */
    WebhookSignatureInvalid = "HTTP_SECURITY_WEBHOOK_SIGNATURE_INVALID",
    /** A webhook delivery was signed outside the replay window: a captured delivery sent again later. */
    WebhookReplayed = "HTTP_SECURITY_WEBHOOK_REPLAYED",
    /** A door asked for a webhook provider the app did not configure. */
    WebhookProviderUnknown = "HTTP_SECURITY_WEBHOOK_PROVIDER_UNKNOWN",
}

/** How each http-security code travels. */
export const HTTP_SECURITY_ERROR_KINDS: Record<HttpSecurityErrorCode, ErrorKind> = {
    [HttpSecurityErrorCode.OriginRejected]: "forbidden",
    [HttpSecurityErrorCode.RateLimited]: "rate-limited",
    [HttpSecurityErrorCode.RequestInvalid]: "invalid",
    [HttpSecurityErrorCode.WebhookSignatureInvalid]: "unauthenticated",
    [HttpSecurityErrorCode.WebhookReplayed]: "unauthenticated",
    [HttpSecurityErrorCode.WebhookProviderUnknown]: "internal",
}

/** The one error class of the http-security capability. */
export class HttpSecurityError extends DomainError<HttpSecurityErrorCode> {}
