import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the account capability. */
export enum AccountErrorCode {
    /** The email is already registered. */
    EmailTaken = "ACCOUNT_EMAIL_TAKEN",
    /** The email or the password is wrong; the code never says which half. */
    InvalidCredentials = "ACCOUNT_INVALID_CREDENTIALS",
    /** No person has this id. */
    PersonUnknown = "ACCOUNT_PERSON_UNKNOWN",
}

/** How each account code travels. */
export const ACCOUNT_ERROR_KINDS: Record<AccountErrorCode, ErrorKind> = {
    [AccountErrorCode.EmailTaken]: "conflict",
    [AccountErrorCode.InvalidCredentials]: "unauthenticated",
    [AccountErrorCode.PersonUnknown]: "not-found",
}

/** The one error class of the account capability. */
export class AccountError extends DomainError<AccountErrorCode> {}
