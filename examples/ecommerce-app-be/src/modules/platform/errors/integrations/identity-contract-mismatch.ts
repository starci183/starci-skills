import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/** Metadata for an identity answer outside its contract; no extra fields required. */
export interface IdentityContractMismatchExceptionMetadata extends DomainErrorMetadata {
}

/**
 * House failure carrying code IDENTITY_CONTRACT_MISMATCH_EXCEPTION, which a transport maps to status 503: the identity
 * service answered 2xx but outside its contract - an unreadable body or a personId that is not a
 * usable string. An off-contract answer is a dependency failure, never a guess.
 */
export class IdentityContractMismatchException extends DomainError {
    constructor({ ...metadata }: IdentityContractMismatchExceptionMetadata) {
        super("IDENTITY_CONTRACT_MISMATCH_EXCEPTION",
            "The identity service answered outside its contract.",
            {
                metadata: metadata 
            })
    }
}
