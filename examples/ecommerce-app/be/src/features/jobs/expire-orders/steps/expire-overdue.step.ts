import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { ExpireOverdueCommand } from "../application/expire-overdue.command"

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
        await this.commandBus.execute(new ExpireOverdueCommand({ request: { payload: job.payload } }))
    }
}
