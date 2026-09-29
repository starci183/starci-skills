import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/** Metadata for an account lookup that found no person; no extra fields required. */
export interface PersonUnknownExceptionMetadata extends DomainErrorMetadata {
}

/**
 * House refusal carrying code PERSON_UNKNOWN_EXCEPTION, which a transport maps to status 404: no person answers the id
 * the account door was asked about.
 */
export class PersonUnknownException extends DomainError {
    constructor({ ...metadata }: PersonUnknownExceptionMetadata) {
        super("PERSON_UNKNOWN_EXCEPTION",
            "No person answers this id.",
            {
                metadata: metadata 
            })
    }
}
