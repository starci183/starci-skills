import {
    HttpStatus 
} from "@nestjs/common"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a request a door refused as malformed; `message` names what was missing or wrong. */
export interface RequestInvalidExceptionMetadata extends AbstractExceptionMetadata {
  /** The refusal phrasing the wire carries - each door states its own contract breach. */
  message: string;
}

/**
 * House refusal carrying code REQUEST_INVALID_EXCEPTION and status 400: the request arrived at a
 * door without what that door's contract requires (a malformed pair, a missing field, a quantity
 * that is not a positive integer). The throw site states the breach in `message`.
 */
export class RequestInvalidException extends AbstractException {
    constructor({ message, ...metadata }: RequestInvalidExceptionMetadata) {
        super(message,
            "REQUEST_INVALID_EXCEPTION",
            metadata,
            HttpStatus.BAD_REQUEST)
    }
}
