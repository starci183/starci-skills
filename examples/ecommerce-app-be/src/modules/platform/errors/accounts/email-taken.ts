import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/** Metadata for a registration refused on an address already taken; no extra fields required. */
export interface EmailTakenExceptionMetadata extends DomainErrorMetadata {
}

/**
 * House refusal carrying code EMAIL_TAKEN_EXCEPTION, which a transport maps to status 409: an account already answers
 * this email, so registration refuses rather than reissuing the person.
 */
export class EmailTakenException extends DomainError {
    constructor({ ...metadata }: EmailTakenExceptionMetadata) {
        super("EMAIL_TAKEN_EXCEPTION",
            "An account already answers this email.",
            {
                metadata: metadata 
            })
    }
}
