import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Database refusal codes are added with the SQL helpers that can raise them. */
export enum DatabaseErrorCode {
}

/** How each installed database refusal travels. */
export const DATABASE_ERROR_KINDS: Record<DatabaseErrorCode, ErrorKind> = {
}

/** The one error class of the database capability. */
export class DatabaseError extends DomainError<DatabaseErrorCode> {}
