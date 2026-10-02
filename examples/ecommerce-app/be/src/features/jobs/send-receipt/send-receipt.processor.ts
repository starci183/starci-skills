import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { RECEIPT_QUEUE } from "@modules/queues/receipt"
import { StoreReceiptStep } from "./steps/store-receipt.step"

@Injectable()
/** The processor of the send-receipt job: the base class claims the job with its fencing token and settles it, `process` runs the one step. */
export class SendReceiptProcessor extends FencedProcessor {
    readonly queue = RECEIPT_QUEUE

    constructor(private readonly storeReceipt: StoreReceiptStep) {
        super()
    }

    /** Stores the receipt; a stale token throws the fenced-out error from the guarded write before the external effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.storeReceipt.run(job)
    }
}
