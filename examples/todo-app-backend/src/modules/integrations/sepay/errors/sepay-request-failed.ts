import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a SePay call the gateway did not answer with a usable result. */
export interface SepayRequestFailedExceptionMetadata extends DomainErrorMetadata {
  /** The composed refusal: what the gateway said, and whether a credential went out. */
  reason?: string;
}

/**
 * integration.plan.sepay: a create-intent or get-transaction call failed - the gateway was
 * unreachable, answered a non-OK status, or returned a body the client cannot honour. `reason`
 * carries the gateway's own status wording rather than a masked one (gap.plan.sepay-not-reachable).
 */
export class SepayRequestFailedException extends DomainError {
    constructor({ reason, ...metadata }: SepayRequestFailedExceptionMetadata) {
        super("SEPAY_REQUEST_FAILED_EXCEPTION",
            reason ?? "The SePay request failed.",
            {
                metadata: {
                    reason, ...metadata 
                } 
            })
    }
}
