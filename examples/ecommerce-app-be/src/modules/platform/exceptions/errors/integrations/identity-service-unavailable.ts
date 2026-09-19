import {
    HttpStatus 
} from "@nestjs/common"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for an identity call that could not complete; `message` states which failure answered. */
export interface IdentityServiceUnavailableExceptionMetadata extends AbstractExceptionMetadata {
  /** What the outage looked like - unreachable, or an upstream status that is not the contract. */
  message: string;
}

/**
 * House failure carrying code IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION and status 503: the identity
 * service could not be reached, or answered a status outside the session contract. Never a
 * pass-through of the upstream error and never an implied answer - the caller learns the
 * dependency failed, nothing more.
 */
export class IdentityServiceUnavailableException extends AbstractException {
    constructor({ message, ...metadata }: IdentityServiceUnavailableExceptionMetadata) {
        super(message,
            "IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION",
            metadata,
            HttpStatus.SERVICE_UNAVAILABLE)
    }
}
