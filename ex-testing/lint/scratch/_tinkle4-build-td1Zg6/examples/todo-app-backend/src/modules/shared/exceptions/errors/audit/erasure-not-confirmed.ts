import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata attached to a ErasureNotConfirmedException throw so the refusal is queryable rather than only readable. */
export interface ErasureNotConfirmedExceptionMetadata extends AbstractExceptionMetadata {
  requestId?: string;
}

/**
 * fr.audit.erasure.complete's exceptionFlow: if any of the subject's lines still decrypts after key
 * destruction, completion is refused rather than reported as done. Reaching this in practice would mean
 * the keystore delete did not take effect; the request stays in `executing`, not `complete` or `refused`,
 * so a retry of completeErasure can be attempted rather than the failure being buried as a false success.
 */
export class ErasureNotConfirmedException extends AbstractException {
    constructor({ requestId, ...metadata }: ErasureNotConfirmedExceptionMetadata = {
    }) {
        super("The subject remains readable after key destruction; completion is refused.",
            "ERASURE_NOT_CONFIRMED_EXCEPTION",
            {
                requestId,
                ...metadata,
            })
    }
}
