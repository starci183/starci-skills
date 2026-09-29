import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/** Metadata for a request a door refused as malformed; `message` names what was missing or wrong. */
export interface RequestInvalidExceptionMetadata extends DomainErrorMetadata {
  /** The refusal phrasing the wire carries - each door states its own contract breach. */
  message: string;
}

/**
 * House refusal carrying code REQUEST_INVALID_EXCEPTION, which a transport maps to status 400: the request arrived at a
 * door without what that door's contract requires (a malformed pair, a missing field, a quantity
 * that is not a positive integer). The throw site states the breach in `message`.
 */
export class RequestInvalidException extends DomainError {
    constructor({ message, ...metadata }: RequestInvalidExceptionMetadata) {
        super("REQUEST_INVALID_EXCEPTION",
            message,
            {
                metadata: metadata 
            })
    }
}
