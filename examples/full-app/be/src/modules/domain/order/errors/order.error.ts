import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the order capability. */
export enum OrderErrorCode {
    /** The cart is empty, so there is nothing to confirm. */
    CartEmpty = "ORDER_CART_EMPTY",
    /** A cart line names a product the catalog does not have. */
    UnknownProduct = "ORDER_UNKNOWN_PRODUCT",
    /** A product has less stock than the cart asks for. */
    InsufficientStock = "ORDER_INSUFFICIENT_STOCK",
    /** The order row could not be written and no earlier order explains it; a defect. */
    PlacementFailed = "ORDER_PLACEMENT_FAILED",
    /** The buyer has no order with that id (or it is another buyer's). */
    ReceiptNotFound = "ORDER_RECEIPT_NOT_FOUND",
    /** The receipt is not archived yet and the archive cannot take it now. */
    ReceiptNotReady = "ORDER_RECEIPT_NOT_READY",
}

/** How each order code travels. */
export const ORDER_ERROR_KINDS: Record<OrderErrorCode, ErrorKind> = {
    [OrderErrorCode.CartEmpty]: "invalid",
    [OrderErrorCode.UnknownProduct]: "invalid",
    [OrderErrorCode.InsufficientStock]: "conflict",
    [OrderErrorCode.PlacementFailed]: "internal",
    [OrderErrorCode.ReceiptNotFound]: "not-found",
    [OrderErrorCode.ReceiptNotReady]: "unavailable",
}

/** The one error class of the order capability. */
export class OrderError extends DomainError<OrderErrorCode> {}
