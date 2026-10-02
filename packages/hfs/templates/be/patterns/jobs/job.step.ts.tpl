import { Injectable } from "@nestjs/common"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** One external effect of the @@job@@ job. */
export class @@Step@@Step implements JobStep {
    constructor(@InjectJobClaims() private readonly claims: JobClaims) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then makes the
     * one delegating call the step is allowed (R203 `BE_FEATURE_THIN`), handing the module service the payload as delivered
     * and the run key of this claim. Reading the payload, guarding it and sequencing the effect are the service's.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "@@step@@" })
        // The one delegating call: the module service takes `job.payload` and `this.claims.runKey(job, "@@step@@")` as the idempotency key of the effect.
    }
}
