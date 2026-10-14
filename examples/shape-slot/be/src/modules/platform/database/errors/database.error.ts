import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the database capability. */
export enum DatabaseErrorCode {
    /** A dynamic SQL identifier was not on the list of names its caller allows. */
    IdentifierRejected = "DATABASE_IDENTIFIER_REJECTED",
    /** The required primary connection failed or exceeded its readiness deadline. */
    RequiredUnavailable = "DATABASE_REQUIRED_UNAVAILABLE",
}

/** How each database code travels. */
export const DATABASE_ERROR_KINDS: Record<DatabaseErrorCode, ErrorKind> = {
    [DatabaseErrorCode.IdentifierRejected]: "internal",
    [DatabaseErrorCode.RequiredUnavailable]: "unavailable",
}

/** The one error class of the database capability. */
export class DatabaseError extends DomainError<DatabaseErrorCode> {}
