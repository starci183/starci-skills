import {
    HttpStatus 
} from "@nestjs/common"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a refused credential pair; nothing extra is required beyond debug fields. */
export interface InvalidCredentialsExceptionMetadata extends AbstractExceptionMetadata {
}

/**
 * House refusal carrying code INVALID_CREDENTIALS_EXCEPTION and status 401: the email/password
 * pair is not recognized (br.identity.sign-in - the refusal names neither half, so an unknown
 * email and a wrong password answer identically).
 */
export class InvalidCredentialsException extends AbstractException {
    constructor({ ...metadata }: InvalidCredentialsExceptionMetadata) {
        super("The email and password pair is not recognized.",
            "INVALID_CREDENTIALS_EXCEPTION",
            metadata,
            HttpStatus.UNAUTHORIZED)
    }
}
