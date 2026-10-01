import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the SePay integration. */
export enum SepayErrorCode {
    /** A gateway call failed: the gateway was unreachable, answered a failure status or answered outside its contract; `operation` and `reason` ride in the params. */
    RequestFailed = "SEPAY_REQUEST_FAILED",
    /** A webhook delivery did not carry the shared secret. */
    WebhookUnauthorized = "SEPAY_WEBHOOK_UNAUTHORIZED",
}

/** How each SePay code travels. */
export const SEPAY_ERROR_KINDS: Record<SepayErrorCode, ErrorKind> = {
    [SepayErrorCode.RequestFailed]: "unavailable",
    [SepayErrorCode.WebhookUnauthorized]: "unauthenticated",
}

/** The one error class of the SePay integration. */
export class SepayError extends DomainError<SepayErrorCode> {}
