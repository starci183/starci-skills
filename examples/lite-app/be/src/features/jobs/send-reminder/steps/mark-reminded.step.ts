import { Injectable } from "@nestjs/common"
import { BookingsService } from "@modules/domain/bookings"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/**
 * The one effect of the job: the booking the job names is marked reminded, or — for a pg_cron tick — every confirmed
 * booking due a reminder is. A reminded booking is left as it is, so a repeated delivery changes nothing.
 */
export class MarkRemindedStep implements JobStep {
    constructor(
        private readonly bookings: BookingsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then marks
     * the reminder sent.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "remind" })
        await this.bookings.remindBooking(job.payload)
    }
}
