import { Injectable } from "@nestjs/common"
import { BookingsService } from "@modules/domain/bookings"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the pending booking of the claimed job becomes confirmed. */
export class MarkConfirmedStep implements JobStep {
    constructor(
        private readonly bookings: BookingsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then confirms the
     * booking (a confirmed booking is left as it is, so a repeat changes nothing).
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "confirm" })
        await this.bookings.confirmBooking(job.payload)
    }
}
