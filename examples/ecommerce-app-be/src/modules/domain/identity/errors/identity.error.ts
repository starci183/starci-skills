import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the identity capability: what the auth guard refuses with. */
export enum IdentityErrorCode {
    /** The door needs a live session and the request has none. */
    Unauthenticated = "IDENTITY_UNAUTHENTICATED",
    /** The caller is authenticated but lacks a role the door requires. */
    Forbidden = "IDENTITY_FORBIDDEN",
}

/** How each identity code travels. */
export const IDENTITY_ERROR_KINDS: Record<IdentityErrorCode, ErrorKind> = {
    [IdentityErrorCode.Unauthenticated]: "unauthenticated",
    [IdentityErrorCode.Forbidden]: "forbidden",
}

/** The one error class of the identity capability. */
export class IdentityError extends DomainError<IdentityErrorCode> {}
