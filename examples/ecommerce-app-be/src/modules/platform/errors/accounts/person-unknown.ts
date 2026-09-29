import {
    HttpStatus 
} from "@nestjs/common"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for an account lookup that found no person; no extra fields required. */
export interface PersonUnknownExceptionMetadata extends AbstractExceptionMetadata {
}

/**
 * House refusal carrying code PERSON_UNKNOWN_EXCEPTION and status 404: no person answers the id
 * the account door was asked about.
 */
export class PersonUnknownException extends AbstractException {
    constructor({ ...metadata }: PersonUnknownExceptionMetadata) {
        super("No person answers this id.",
            "PERSON_UNKNOWN_EXCEPTION",
            metadata,
            HttpStatus.NOT_FOUND)
    }
}
