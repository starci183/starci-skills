import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { AdvanceWrite, ClaimedJob, ClaimParams, FailWrite, GuardedWrite, RunKey } from "./jobs.contracts"
import { InjectJobsManager } from "./jobs.decorators"
import type { JobClaims } from "./jobs.port"
import { ADVANCE_JOB, CLAIM_JOB, COMPLETE_JOB, FAIL_JOB } from "./persistence/jobs.sql"
import type { ClaimedRow } from "./persistence/jobs.rows"

@Injectable()
/**
 * The one owner of the job row. A claim is one atomic upsert that bumps the fencing token in the store, so two workers can never
 * hold the same token; every other write is `WHERE fencing_token = <expected>`, so a worker that lost its claim (a zombie) changes
 * nothing and learns it from `JobFencedOut`.
 */
export class JobClaimService implements JobClaims {
    constructor(
        @InjectJobsManager() private readonly manager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Claims the delivery; null when the job is done or another worker holds a claim that has not expired. */
    async claim(params: ClaimParams): Promise<ClaimedJob | null> {
        const now = this.clock.now()
        const rows: Array<ClaimedRow> = await this.manager.query(CLAIM_JOB, [
            params.kind,
            params.jobKey,
            params.workerId,
            new Date(now.getTime() + params.leaseMs),
            JSON.stringify(params.payload),
            now,
        ])
        const row = rows[0]
        if (row === undefined) return null
        return {
            jobId: row.id,
            kind: row.kind,
            fencingToken: Number(row.fencing_token),
            currentStep: row.current_step,
            payload: row.payload,
        }
    }

    /** Records a finished step under the token the caller holds. */
    advance(write: AdvanceWrite): Promise<void> {
        return this.guarded(ADVANCE_JOB, [write.jobId, write.expectedFencingToken, write.step, this.clock.now()], write)
    }

    /** Completes the job under the token the caller holds. */
    complete(write: GuardedWrite): Promise<void> {
        return this.guarded(COMPLETE_JOB, [write.jobId, write.expectedFencingToken, this.clock.now()], write)
    }

    /** Marks the job failed under the token the caller holds, so BullMQ can retry it. */
    fail(write: FailWrite): Promise<void> {
        return this.guarded(FAIL_JOB, [write.jobId, write.expectedFencingToken, write.reason, this.clock.now()], write)
    }

    /** The idempotency key of one step of this claim: it includes the token, so a zombie's repeat is a different key than the live worker's. */
    runKey(job: ClaimedJob, step: string): RunKey {
        return `${job.jobId}:${step}:${job.fencingToken}` as RunKey
    }

    /** Runs a statement that updates only when the token still matches; no row updated means a newer worker owns the job. */
    private async guarded(statement: string, parameters: Array<unknown>, write: GuardedWrite): Promise<void> {
        const rows: Array<object> = await this.manager.query(statement, parameters)
        if (rows.length === 0) {
            throw new JobsError({
                code: JobsErrorCode.FencedOut,
                params: { jobId: write.jobId, token: write.expectedFencingToken },
            })
        }
    }
}
