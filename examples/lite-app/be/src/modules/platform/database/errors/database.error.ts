import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the database capability. */
export enum DatabaseErrorCode {
    /** A dynamic SQL identifier was not on the list of names its caller allows. */
    IdentifierRejected = "DATABASE_IDENTIFIER_REJECTED",
    /** A signed delivery omitted the provider's non-empty idempotency key. */
    WebhookDeliveryIdRequired = "DATABASE_WEBHOOK_DELIVERY_ID_REQUIRED",
}

/** How each database code travels. */
export const DATABASE_ERROR_KINDS: Record<DatabaseErrorCode, ErrorKind> = {
    [DatabaseErrorCode.IdentifierRejected]: "internal",
    [DatabaseErrorCode.WebhookDeliveryIdRequired]: "invalid",
}

/** The one error class of the database capability. */
export class DatabaseError extends DomainError<DatabaseErrorCode> {}
