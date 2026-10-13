import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { BOOKING_CONFIRMATION_QUEUE } from "@modules/queues/booking-confirmation"
import { MarkConfirmedStep } from "../../steps/mark-confirmed.step"

@Injectable()
/** The processor of the confirm-booking job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class ConfirmBookingProcessor extends FencedProcessor {
    readonly queue = BOOKING_CONFIRMATION_QUEUE

    constructor(private readonly markConfirmed: MarkConfirmedStep) {
        super()
    }

    /** Confirms the booking; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.markConfirmed.run(job)
    }
}
