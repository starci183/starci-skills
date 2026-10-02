import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the invoice capability. */
export enum InvoiceErrorCode {
    /** The order total is above what one invoice may bill; the invoice is recorded as rejected. */
    OverLimit = "INVOICE_OVER_LIMIT",
}

/** How each invoice code travels. */
export const INVOICE_ERROR_KINDS: Record<InvoiceErrorCode, ErrorKind> = {
    [InvoiceErrorCode.OverLimit]: "conflict",
}

/** The one error class of the invoice capability. */
export class InvoiceError extends DomainError<InvoiceErrorCode> {}
