import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the session capability. */
export enum SessionErrorCode {
    /** The request carries no live session: the token is missing, malformed or unknown. */
    NotFound = "SESSION_NOT_FOUND",
    /** The session existed and has lapsed. */
    Expired = "SESSION_EXPIRED",
    /** The email or the password is wrong; the code never says which half. */
    InvalidCredentials = "SESSION_INVALID_CREDENTIALS",
    /** The caller is authenticated but lacks a role the door requires. */
    Forbidden = "SESSION_FORBIDDEN",
    /** The identity provider could not be reached. */
    ProviderUnavailable = "SESSION_PROVIDER_UNAVAILABLE",
}

/** How each session code travels. */
export const SESSION_ERROR_KINDS: Record<SessionErrorCode, ErrorKind> = {
    [SessionErrorCode.NotFound]: "unauthenticated",
    [SessionErrorCode.Expired]: "unauthenticated",
    [SessionErrorCode.InvalidCredentials]: "unauthenticated",
    [SessionErrorCode.Forbidden]: "forbidden",
    [SessionErrorCode.ProviderUnavailable]: "unavailable",
}

/** The one error class of the session capability. */
export class SessionError extends DomainError<SessionErrorCode> {}
