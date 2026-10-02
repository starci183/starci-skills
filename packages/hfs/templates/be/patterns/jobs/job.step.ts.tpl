import { Injectable } from "@nestjs/common"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** One external effect of the @@job@@ job. */
export class @@Step@@Step implements JobStep {
    constructor(@InjectJobClaims() private readonly claims: JobClaims) {}

    /** Performs the effect with the run key of this claim as its idempotency key, then records the step with the fencing token. */
    async run(job: ClaimedJob): Promise<void> {
        // Call the integration here and pass `this.claims.runKey(job, "@@step@@")` to it as the idempotency key.
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "@@step@@" })
    }
}
