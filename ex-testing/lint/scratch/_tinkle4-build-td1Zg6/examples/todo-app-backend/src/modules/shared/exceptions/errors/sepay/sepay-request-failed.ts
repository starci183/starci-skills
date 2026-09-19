import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a SePay call the gateway did not answer with a usable result. */
export interface SepayRequestFailedExceptionMetadata extends AbstractExceptionMetadata {
  /** The composed refusal: what the gateway said, and whether a credential went out. */
  reason?: string;
}

/**
 * integration.plan.sepay: a create-intent or get-transaction call failed - the gateway was
 * unreachable, answered a non-OK status, or returned a body the client cannot honour. `reason`
 * carries the gateway's own status wording rather than a masked one (gap.plan.sepay-not-reachable).
 */
export class SepayRequestFailedException extends AbstractException {
    constructor({ reason, ...metadata }: SepayRequestFailedExceptionMetadata) {
        super(reason ?? "The SePay request failed.",
            "SEPAY_REQUEST_FAILED_EXCEPTION",
            {
                reason, ...metadata 
            })
    }
}
