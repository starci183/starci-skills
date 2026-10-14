import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { BOOKING_REMINDER_QUEUE } from "@modules/queues/booking-reminder"
import { MarkRemindedStep } from "../../steps/mark-reminded.step"

@Injectable()
/**
 * The processor of the send-reminder job: the runner claims and settles every delivery — a booking's own reminder and
 * the catch-up tick pg_cron enqueues alike; `process` delegates the fenced claim to the one step.
 */
export class SendReminderProcessor extends FencedProcessor {
    readonly queue = BOOKING_REMINDER_QUEUE

    constructor(private readonly markReminded: MarkRemindedStep) {
        super()
    }

    /** Marks the reminder sent; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.markReminded.run(job)
    }
}
