/** A job a worker claimed: the token it must pass to every write. */
export interface ClaimedJob {
    /** The id of the job row. */
    readonly jobId: string
    /** The kind of the job: the queue its processor consumes. */
    readonly kind: string
    /** The fencing token of this claim; the claim bumped it, so an older worker holds a smaller one. */
    readonly fencingToken: number
    /** The last step a worker recorded, or null before the first. */
    readonly currentStep: string | null
    /** The payload the producer wrote. */
    readonly payload: object
}

/** What a worker asks for when it claims a delivery. */
export interface ClaimParams {
    /** The kind of the job. */
    readonly kind: string
    /** The key of the delivery: the BullMQ job id. A second claim of the same key bumps the token of the same row. */
    readonly jobKey: string
    /** The payload to store on the first claim. */
    readonly payload: object
    /** The name of the claiming worker. */
    readonly workerId: string
    /** How long the claim lasts. */
    readonly leaseMs: number
}

/** The target of one guarded write: the job and the token the writer holds. Required in the type, never optional. */
export interface GuardedWrite {
    /** The id of the job row. */
    readonly jobId: string
    /** The token the writer received from its claim. */
    readonly expectedFencingToken: number
}

/** A guarded write that records a step. */
export interface AdvanceWrite extends GuardedWrite {
    /** The step that finished. */
    readonly step: string
}

/** A guarded write that fails the job. */
export interface FailWrite extends GuardedWrite {
    /** Why the job failed. */
    readonly reason: string
}

/** The idempotency key of an external effect: only `JobClaims.runKey` makes one. */
export type RunKey = string & {
    /** The brand that keeps a plain string from passing as a run key; it never exists at run time. */
    readonly __runKey: unique symbol
}

/** The shape of a run key: `<jobId>:<step>:<fencingToken>`. */
const RUN_KEY = /^[^:]+:[^:]+:\d+$/u

/** True when the text has the shape of a run key; the one place a string becomes a `RunKey`. */
export const isRunKey = (text: string): text is RunKey => RUN_KEY.test(text)

/** What a claim answers: the claimed job, or null when the job is done or another worker holds a live claim. */
export type ClaimResult = ClaimedJob | null
