import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the identity api integration. */
export enum IdentityApiErrorCode {
    /** The identity service could not be reached or refused to answer. */
    Unavailable = "IDENTITY_API_UNAVAILABLE",
    /** The identity service answered in a shape this client does not know. */
    ContractMismatch = "IDENTITY_API_CONTRACT_MISMATCH",
}

/** How each identity api code travels. */
export const IDENTITY_API_ERROR_KINDS: Record<IdentityApiErrorCode, ErrorKind> = {
    [IdentityApiErrorCode.Unavailable]: "unavailable",
    [IdentityApiErrorCode.ContractMismatch]: "internal",
}

/** The one error class of the identity api integration. */
export class IdentityApiError extends DomainError<IdentityApiErrorCode> {}
