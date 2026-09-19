import {
    HttpStatus 
} from "@nestjs/common"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a registration refused on an address already taken; no extra fields required. */
export interface EmailTakenExceptionMetadata extends AbstractExceptionMetadata {
}

/**
 * House refusal carrying code EMAIL_TAKEN_EXCEPTION and status 409: an account already answers
 * this email, so registration refuses rather than reissuing the person.
 */
export class EmailTakenException extends AbstractException {
    constructor({ ...metadata }: EmailTakenExceptionMetadata) {
        super("An account already answers this email.",
            "EMAIL_TAKEN_EXCEPTION",
            metadata,
            HttpStatus.CONFLICT)
    }
}
