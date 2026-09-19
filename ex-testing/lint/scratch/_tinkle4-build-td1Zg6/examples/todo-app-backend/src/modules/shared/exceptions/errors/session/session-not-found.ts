import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Type alias naming the session not found exception metadata set session-not-found switches on; a new member is added here once, not scattered as literals. */
export type SessionNotFoundExceptionMetadata = AbstractExceptionMetadata;

/** House refusal carrying code SESSION_NOT_FOUND_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the session not found refusal turned on. */
export class SessionNotFoundException extends AbstractException {
    constructor(metadata: SessionNotFoundExceptionMetadata = {
    }) {
        super("The session is not active.",
            "SESSION_NOT_FOUND_EXCEPTION",
            metadata)
    }
}
