import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the identity capability. */
export enum IdentityErrorCode {
    /** The door needs a signed-in caller and the request establishes none. */
    Unauthenticated = "IDENTITY_UNAUTHENTICATED",
}

/** How each identity code travels. */
export const IDENTITY_ERROR_KINDS: Record<IdentityErrorCode, ErrorKind> = {
    [IdentityErrorCode.Unauthenticated]: "unauthenticated",
}

/** The one error class of the identity capability. */
export class IdentityError extends DomainError<IdentityErrorCode> {}
