import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the receipt storage integration. */
export enum ReceiptStorageErrorCode {
    /** The storage could not be reached, did not answer in time or refused the write. */
    Unavailable = "RECEIPT_STORAGE_UNAVAILABLE",
}

/** How each receipt storage code travels. */
export const RECEIPT_STORAGE_ERROR_KINDS: Record<ReceiptStorageErrorCode, ErrorKind> = {
    [ReceiptStorageErrorCode.Unavailable]: "unavailable",
}

/** The one error class of the receipt storage integration. */
export class ReceiptStorageError extends DomainError<ReceiptStorageErrorCode> {}
