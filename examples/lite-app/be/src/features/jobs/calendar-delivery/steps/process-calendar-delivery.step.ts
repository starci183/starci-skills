import { Injectable } from "@nestjs/common"
import { CalendarInboxService } from "@modules/domain/calendar-inbox"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The fenced step that resolves a committed calendar receipt. */
export class ProcessCalendarDeliveryStep implements JobStep {
    constructor(
        private readonly inbox: CalendarInboxService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the worker's fence before the domain consumer can perform its receipt effect. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({
            jobId: job.jobId,
            expectedFencingToken: job.fencingToken,
            step: "calendar-delivery",
        })
        await this.inbox.processRecordedDelivery(job.payload)
    }
}
