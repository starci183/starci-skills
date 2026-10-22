import { Injectable } from "@nestjs/common"
import { ReceiptService } from "@modules/domain/order"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one external effect of the job: the receipt of a paid order stored in the private archive. */
export class StoreReceiptStep implements JobStep {
    constructor(
        private readonly receipts: ReceiptService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then archives
     * the receipt with the run key of this claim (it includes the token).
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "store" })
        await this.receipts.archiveReceipt(job.payload, this.claims.runKey(job, "store"))
    }
}
