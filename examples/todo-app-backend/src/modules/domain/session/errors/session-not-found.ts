import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Type alias naming the session not found exception metadata set session-not-found switches on; a new member is added here once, not scattered as literals. */
export type SessionNotFoundExceptionMetadata = DomainErrorMetadata;

/** House refusal carrying code SESSION_NOT_FOUND_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the session not found refusal turned on. */
export class SessionNotFoundException extends DomainError {
    constructor(metadata: SessionNotFoundExceptionMetadata = {
    }) {
        super("SESSION_NOT_FOUND_EXCEPTION",
            "The session is not active.",
            {
                metadata: metadata 
            })
    }
}
