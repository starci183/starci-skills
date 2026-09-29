import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an erasure request that cannot be resolved. */
export interface ErasureRequestNotFoundExceptionMetadata extends DomainErrorMetadata {
  /** The requestId looked up. */
  requestId?: string;
}

/** sds.audit.erasure-request: every transition after t-request needs a resolvable request row. */
export class ErasureRequestNotFoundException extends DomainError {
    constructor({ requestId, ...metadata }: ErasureRequestNotFoundExceptionMetadata = {
    }) {
        super("ERASURE_REQUEST_NOT_FOUND_EXCEPTION",
            "The erasure request does not exist.",
            {
                metadata: {
                    requestId, ...metadata 
                } 
            })
    }
}
