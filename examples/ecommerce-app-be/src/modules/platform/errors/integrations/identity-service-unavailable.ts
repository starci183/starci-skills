import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/** Metadata for an identity call that could not complete; `message` states which failure answered. */
export interface IdentityServiceUnavailableExceptionMetadata extends DomainErrorMetadata {
  /** What the outage looked like - unreachable, or an upstream status that is not the contract. */
  message: string;
}

/**
 * House failure carrying code IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION, which a transport maps to status 503: the identity
 * service could not be reached, or answered a status outside the session contract. Never a
 * pass-through of the upstream error and never an implied answer - the caller learns the
 * dependency failed, nothing more.
 */
export class IdentityServiceUnavailableException extends DomainError {
    constructor({ message, ...metadata }: IdentityServiceUnavailableExceptionMetadata) {
        super("IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION",
            message,
            {
                metadata: metadata 
            })
    }
}
