import {
    HttpStatus 
} from "@nestjs/common"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for an identity answer outside its contract; no extra fields required. */
export interface IdentityContractMismatchExceptionMetadata extends AbstractExceptionMetadata {
}

/**
 * House failure carrying code IDENTITY_CONTRACT_MISMATCH_EXCEPTION and status 503: the identity
 * service answered 2xx but outside its contract - an unreadable body or a personId that is not a
 * usable string. An off-contract answer is a dependency failure, never a guess.
 */
export class IdentityContractMismatchException extends AbstractException {
    constructor({ ...metadata }: IdentityContractMismatchExceptionMetadata) {
        super("The identity service answered outside its contract.",
            "IDENTITY_CONTRACT_MISMATCH_EXCEPTION",
            metadata,
            HttpStatus.SERVICE_UNAVAILABLE)
    }
}
