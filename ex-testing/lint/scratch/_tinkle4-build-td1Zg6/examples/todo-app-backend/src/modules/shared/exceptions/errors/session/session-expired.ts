import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Type alias naming the session expired exception metadata set session-expired switches on; a new member is added here once, not scattered as literals. */
export type SessionExpiredExceptionMetadata = AbstractExceptionMetadata;

/** House refusal carrying code SESSION_EXPIRED_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the session expired refusal turned on. */
export class SessionExpiredException extends AbstractException {
    constructor(metadata: SessionExpiredExceptionMetadata = {
    }) {
        super("The session has expired.",
            "SESSION_EXPIRED_EXCEPTION",
            metadata)
    }
}
