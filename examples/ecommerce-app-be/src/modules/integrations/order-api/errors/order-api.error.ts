import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the order api integration. */
export enum OrderApiErrorCode {
    /** The order service could not be reached or reported an error. */
    Unavailable = "ORDER_API_UNAVAILABLE",
    /** The order service answered in a shape this client does not know. */
    ContractMismatch = "ORDER_API_CONTRACT_MISMATCH",
}

/** How each order api code travels. */
export const ORDER_API_ERROR_KINDS: Record<OrderApiErrorCode, ErrorKind> = {
    [OrderApiErrorCode.Unavailable]: "unavailable",
    [OrderApiErrorCode.ContractMismatch]: "internal",
}

/** The one error class of the order api integration. */
export class OrderApiError extends DomainError<OrderApiErrorCode> {}
