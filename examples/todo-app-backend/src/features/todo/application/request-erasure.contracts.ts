import type { AuditErrorCode } from "@modules/domain/audit"
import type { Outcome } from "@modules/platform/primitives"

/** Requesting an erasure takes no input: the subject is always the caller. */
export type RequestErasureRequest = Readonly<Record<string, never>>

/** The request that was opened. */
export interface ErasureReceipt {
    /** The opaque request id the completion takes. */
    readonly requestId: string
    /** The state of the request. */
    readonly state: string
}

/** The opened and verified request, or the refusal that names why none was opened. */
export type RequestErasureResult = Outcome<ErasureReceipt, AuditErrorCode>
