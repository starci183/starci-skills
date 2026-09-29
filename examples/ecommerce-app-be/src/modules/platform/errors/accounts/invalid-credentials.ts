import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/** Metadata for a refused credential pair; nothing extra is required beyond debug fields. */
export interface InvalidCredentialsExceptionMetadata extends DomainErrorMetadata {
}

/**
 * House refusal carrying code INVALID_CREDENTIALS_EXCEPTION, which a transport maps to status 401: the email/password
 * pair is not recognized (br.identity.sign-in - the refusal names neither half, so an unknown
 * email and a wrong password answer identically).
 */
export class InvalidCredentialsException extends DomainError {
    constructor({ ...metadata }: InvalidCredentialsExceptionMetadata) {
        super("INVALID_CREDENTIALS_EXCEPTION",
            "The email and password pair is not recognized.",
            {
                metadata: metadata 
            })
    }
}
