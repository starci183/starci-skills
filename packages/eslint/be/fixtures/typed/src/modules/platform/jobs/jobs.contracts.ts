/** A job a worker claimed: the token it must pass to every write. */
export interface ClaimedJob {
    readonly jobId: string
    readonly kind: string
    readonly fencingToken: number
    readonly currentStep: string | null
}

/** The target of one guarded write: the job and the token the writer holds. Required, never optional. */
export interface GuardedWrite {
    readonly jobId: string
    readonly expectedFencingToken: number
}

/** The idempotency key of an external effect: only `JobClaims.runKey` makes one. */
export type RunKey = string & { readonly __runKey: unique symbol }

/** A write that forgot the token (fixture of a broken port). */
export interface LooseWrite {
    readonly jobId: string
    readonly expectedFencingToken?: number
}
