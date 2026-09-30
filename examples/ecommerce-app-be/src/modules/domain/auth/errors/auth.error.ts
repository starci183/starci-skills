import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the auth capability: what the auth guard refuses with. */
export enum AuthErrorCode {
    /** The door needs a live session and the request has none. */
    Unauthenticated = "AUTH_UNAUTHENTICATED",
    /** The caller is authenticated but lacks a role the door requires. */
    Forbidden = "AUTH_FORBIDDEN",
}

/** How each auth code travels. */
export const AUTH_ERROR_KINDS: Record<AuthErrorCode, ErrorKind> = {
    [AuthErrorCode.Unauthenticated]: "unauthenticated",
    [AuthErrorCode.Forbidden]: "forbidden",
}

/** The one error class of the auth capability. */
export class AuthError extends DomainError<AuthErrorCode> {}
