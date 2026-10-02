import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the bookings capability. */
export enum BookingsErrorCode {
    /** No row owned by the authenticated principal has the requested id. */
    NotFound = "BOOKINGS_NOT_FOUND",
}

/** How each bookings code travels. */
export const BOOKINGS_ERROR_KINDS: Record<BookingsErrorCode, ErrorKind> = {
    [BookingsErrorCode.NotFound]: "not-found",
}

/** The one error class of the bookings capability. */
export class BookingsError extends DomainError<BookingsErrorCode> {}
