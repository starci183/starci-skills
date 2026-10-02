import type { EntityManager } from "typeorm"
import type { ClaimedJob, GuardedWrite, RunKey } from "./jobs.contracts"

/** The one door to the job row. */
export interface JobClaims {
    enqueue(tx: EntityManager, params: { kind: string }): Promise<string>
    claim(params: { kind: string; workerId: string }): Promise<ClaimedJob | null>
    advance(write: GuardedWrite & { step: string }): Promise<void>
    complete(write: GuardedWrite): Promise<void>
    runKey(job: ClaimedJob, step: string): RunKey
}

/** One external effect of a job. */
export interface JobStep {
    run(job: ClaimedJob): Promise<void>
}
