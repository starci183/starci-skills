import { Injectable } from "@nestjs/common"
import { ReceiptService } from "@modules/domain/order"
import { InjectReceiptStorage } from "@modules/integrations/receipt-storage"
import type { ReceiptStorage } from "@modules/integrations/receipt-storage"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { isSendReceiptPayload } from "@modules/queues/receipt"

@Injectable()
/** The one external effect of the job: the receipt of a paid order stored in the private archive. */
export class StoreReceiptStep implements JobStep {
    constructor(
        private readonly receipts: ReceiptService,
        @InjectReceiptStorage() private readonly storage: ReceiptStorage,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then stores the
     * document with the run key of this claim (it includes the token) and remembers the key it was stored under.
     */
    async run(job: ClaimedJob): Promise<void> {
        if (!isSendReceiptPayload(job.payload)) return
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "store" })
        const prepared = await this.receipts.prepareReceipt(job.payload.orderId)
        if (prepared === null) return
        await this.storage.store({ key: prepared.key, content: prepared.content }, this.claims.runKey(job, "store"))
        await this.receipts.recordArchived({ orderId: job.payload.orderId, key: prepared.key })
    }
}
