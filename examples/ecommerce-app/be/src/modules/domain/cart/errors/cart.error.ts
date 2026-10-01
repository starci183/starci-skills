import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the cart capability. */
export enum CartErrorCode {
    /** The write did not produce the cart line it should have; a defect, never a business refusal. */
    LineMissing = "CART_LINE_MISSING",
}

/** How each cart code travels. */
export const CART_ERROR_KINDS: Record<CartErrorCode, ErrorKind> = {
    [CartErrorCode.LineMissing]: "internal",
}

/** The one error class of the cart capability. */
export class CartError extends DomainError<CartErrorCode> {}
