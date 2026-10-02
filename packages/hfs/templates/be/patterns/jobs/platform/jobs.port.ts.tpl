import type { AdvanceWrite, ClaimedJob, ClaimParams, FailWrite, GuardedWrite, RunKey } from "./jobs.contracts"
import type { FencedProcessor } from "./fenced.processor"

/** The one door to the job row; `platform/jobs` implements it and nothing else writes the table. */
export interface JobClaims {
    /** Claims the delivery in one atomic statement and bumps the fencing token; null when the job is done or another worker holds a live claim. */
    claim(params: ClaimParams): Promise<ClaimedJob | null>
    /** Records a finished step; throws `JobFencedOut` when the token is stale. */
    advance(write: AdvanceWrite): Promise<void>
    /** Completes the job; throws `JobFencedOut` when the token is stale. */
    complete(write: GuardedWrite): Promise<void>
    /** Fails the job so BullMQ can retry it; throws `JobFencedOut` when the token is stale. */
    fail(write: FailWrite): Promise<void>
    /** The idempotency key of one step of this claim: `<jobId>:<step>:<fencingToken>`. */
    runKey(job: ClaimedJob, step: string): RunKey
}

/** One external effect of a job. */
export interface JobStep {
    /** Performs the effect of the step for the claimed job. */
    run(job: ClaimedJob): Promise<void>
}

/** Where a job module registers its processor. */
export interface JobProcessorRegistry {
    /** Subscribes the processor to its queue. */
    add(processor: FencedProcessor): void
}
