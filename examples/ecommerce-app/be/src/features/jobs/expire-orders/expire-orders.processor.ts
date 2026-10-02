import { Injectable } from "@nestjs/common"
import { ORDER_EXPIRY_QUEUE } from "@modules/queues/order-expiry"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { ExpireOverdueStep } from "./steps/expire-overdue.step"

@Injectable()
/** The processor of the expire-orders job: the base class claims the job with its fencing token and settles it, `process` runs the one step. */
export class ExpireOrdersProcessor extends FencedProcessor {
    readonly queue = ORDER_EXPIRY_QUEUE

    constructor(private readonly expireOverdue: ExpireOverdueStep) {
        super()
    }

    /** Runs the sweep; a stale token throws the fenced-out error from the guarded write of the step and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.expireOverdue.run(job)
    }
}
