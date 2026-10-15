import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the database capability. */
export enum DatabaseErrorCode {
    /** A configured connection has no declared EntityManager injection token. */
    ConnectionUndeclared = "DATABASE_CONNECTION_UNDECLARED",
}

/** How each database code travels. */
export const DATABASE_ERROR_KINDS: Record<DatabaseErrorCode, ErrorKind> = {
    [DatabaseErrorCode.ConnectionUndeclared]: "internal",
}

/** The one error class of the database capability. */
export class DatabaseError extends DomainError<DatabaseErrorCode> {}
