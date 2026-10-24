import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the SePay integration. */
export enum SepayErrorCode {
    /** The SePay API answered in a shape this app does not read. */
    MalformedResponse = "SEPAY_MALFORMED_RESPONSE",
}

/** How each SePay code travels. */
export const SEPAY_ERROR_KINDS: Record<SepayErrorCode, ErrorKind> = {
    [SepayErrorCode.MalformedResponse]: "internal",
}

/** The one error class of the SePay integration. */
export class SepayError extends DomainError<SepayErrorCode> {}
