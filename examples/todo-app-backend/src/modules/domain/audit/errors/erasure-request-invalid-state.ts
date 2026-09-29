import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata attached to a ErasureRequestInvalidStateException throw so the refusal is queryable rather than only readable. */
export interface ErasureRequestInvalidStateExceptionMetadata extends DomainErrorMetadata {
  requestId?: string;
  state?: string;
  expected?: string;
}

/**
 * sds.audit.erasure-request's stateMachine.transitions each declare a `from`; calling completeErasure
 * before the request has reached `verified`, or twice after it already reached a terminal state, is
 * refused here rather than silently no-op'd.
 */
export class ErasureRequestInvalidStateException extends DomainError {
    constructor({ requestId, state, expected, ...metadata }: ErasureRequestInvalidStateExceptionMetadata = {
    }) {
        super("ERASURE_REQUEST_INVALID_STATE_EXCEPTION",
            "The erasure request is not in a state that allows this transition.",
            {
                metadata: {
                    requestId,
                    state,
                    expected,
                    ...metadata,
                } 
            })
    }
}
