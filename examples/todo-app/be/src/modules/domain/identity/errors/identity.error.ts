import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the session capability. */
export enum IdentityErrorCode {
    /** The request carries no live session: the token is missing, malformed or unknown. */
    NotFound = "IDENTITY_SESSION_NOT_FOUND",
    /** The session existed and has lapsed. */
    Expired = "IDENTITY_SESSION_EXPIRED",
    /** The email or the password is wrong; the code never says which half. */
    InvalidCredentials = "IDENTITY_INVALID_CREDENTIALS",
    /** The caller is authenticated but lacks a role the door requires. */
    Forbidden = "IDENTITY_FORBIDDEN",
    /** The identity provider could not be reached. */
    ProviderUnavailable = "IDENTITY_PROVIDER_UNAVAILABLE",
}

/** How each session code travels. */
export const IDENTITY_ERROR_KINDS: Record<IdentityErrorCode, ErrorKind> = {
    [IdentityErrorCode.NotFound]: "unauthenticated",
    [IdentityErrorCode.Expired]: "unauthenticated",
    [IdentityErrorCode.InvalidCredentials]: "unauthenticated",
    [IdentityErrorCode.Forbidden]: "forbidden",
    [IdentityErrorCode.ProviderUnavailable]: "unavailable",
}

/** The one error class of the session capability. */
export class IdentityError extends DomainError<IdentityErrorCode> {}
