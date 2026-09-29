import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Type alias naming the session expired exception metadata set session-expired switches on; a new member is added here once, not scattered as literals. */
export type SessionExpiredExceptionMetadata = DomainErrorMetadata;

/** House refusal carrying code SESSION_EXPIRED_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the session expired refusal turned on. */
export class SessionExpiredException extends DomainError {
    constructor(metadata: SessionExpiredExceptionMetadata = {
    }) {
        super("SESSION_EXPIRED_EXCEPTION",
            "The session has expired.",
            {
                metadata: metadata 
            })
    }
}
