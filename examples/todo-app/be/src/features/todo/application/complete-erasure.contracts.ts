import type { AuditErrorCode } from "@modules/domain/audit"
import type { Outcome } from "@modules/platform/primitives"

/** What completing an erasure takes: the request id. */
export interface CompleteErasureRequest {
    /** The request id. */
    readonly requestId: string
}

/** The request after completion. */
export interface CompletedErasure {
    /** The request id. */
    readonly requestId: string
    /** The state: complete. */
    readonly state: string
}

/** The completed request, or the refusal that names why it was not completed. */
export type CompleteErasureResult = Outcome<CompletedErasure, AuditErrorCode>
