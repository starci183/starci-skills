import {
    AbstractException,
} from "@modules/platform/errors/index"
import type {
    AbstractExceptionMetadata,
} from "@modules/platform/errors/index"

/** Metadata for an erasure request that cannot be resolved. */
export interface ErasureRequestNotFoundExceptionMetadata extends AbstractExceptionMetadata {
  /** The requestId looked up. */
  requestId?: string;
}

/** sds.audit.erasure-request: every transition after t-request needs a resolvable request row. */
export class ErasureRequestNotFoundException extends AbstractException {
    constructor({ requestId, ...metadata }: ErasureRequestNotFoundExceptionMetadata = {
    }) {
        super("The erasure request does not exist.",
            "ERASURE_REQUEST_NOT_FOUND_EXCEPTION",
            {
                requestId, ...metadata 
            })
    }
}
