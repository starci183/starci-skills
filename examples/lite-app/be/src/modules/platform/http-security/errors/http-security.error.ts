import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the http-security capability. */
export enum HttpSecurityErrorCode {
    /** A state-changing request came from an origin that is not on the allowlist. */
    OriginRejected = "HTTP_SECURITY_ORIGIN_REJECTED",
    /** The caller sent more requests than its tier allows in the current window. */
    RateLimited = "HTTP_SECURITY_RATE_LIMITED",
    /** A webhook did not prove the signature of its exact raw body. */
    WebhookSignatureInvalid = "HTTP_SECURITY_WEBHOOK_SIGNATURE_INVALID",
    /** A webhook was signed outside its configured replay window. */
    WebhookReplayed = "HTTP_SECURITY_WEBHOOK_REPLAYED",
    /** A generated webhook route has no provider configuration. */
    WebhookProviderUnknown = "HTTP_SECURITY_WEBHOOK_PROVIDER_UNKNOWN",
}

/** How each http-security code travels. */
export const HTTP_SECURITY_ERROR_KINDS: Record<HttpSecurityErrorCode, ErrorKind> = {
    [HttpSecurityErrorCode.OriginRejected]: "forbidden",
    [HttpSecurityErrorCode.RateLimited]: "rate-limited",
    [HttpSecurityErrorCode.WebhookSignatureInvalid]: "unauthenticated",
    [HttpSecurityErrorCode.WebhookReplayed]: "unauthenticated",
    [HttpSecurityErrorCode.WebhookProviderUnknown]: "internal",
}

/** The one error class of the http-security capability. */
export class HttpSecurityError extends DomainError<HttpSecurityErrorCode> {}
