import {
    HttpStatus 
} from "@nestjs/common"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a refused session token; `message` names how the refusal presented at this door. */
export interface SessionInvalidExceptionMetadata extends AbstractExceptionMetadata {
  /** The refusal phrasing the wire carries - absent token, dead token or missing actor. */
  message: string;
}

/**
 * House refusal carrying code SESSION_INVALID_EXCEPTION and status 401: no live session answers
 * the presented token (or none was presented where one is required). The throw site states which
 * form of the refusal it is - a missing Bearer header, a token no live session owns, or a guarded
 * request that arrived without its actor.
 */
export class SessionInvalidException extends AbstractException {
    constructor({ message, ...metadata }: SessionInvalidExceptionMetadata) {
        super(message,
            "SESSION_INVALID_EXCEPTION",
            metadata,
            HttpStatus.UNAUTHORIZED)
    }
}
