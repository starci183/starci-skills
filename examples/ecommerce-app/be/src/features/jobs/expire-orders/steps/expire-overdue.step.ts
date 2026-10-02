import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { ExpireOverdueCommand } from "../application/expire-overdue.command"
import { ORDER_PAYMENT_WINDOW_MS } from "../application/expire-overdue.contracts"
import { isExpireOrdersPayload } from "../application/expire-overdue.policy"

/** The most orders one sweep expires; a longer backlog is worked off by the next ticks. */
const EXPIRY_BATCH = 100

@Injectable()
/** The one step of the sweep: it expires the orders nobody paid in time. Its effect is a transaction of the order database, repeated safely by the next tick. */
export class ExpireOverdueStep implements JobStep {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds (a stale token stops here), then dispatches the sweep command. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "expire" })
        const olderThanMs = isExpireOrdersPayload(job.payload) ? job.payload.olderThanMs : ORDER_PAYMENT_WINDOW_MS
        await this.commandBus.execute(new ExpireOverdueCommand({ request: { olderThanMs, limit: EXPIRY_BATCH } }))
    }
}
