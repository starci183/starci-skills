import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { CALENDAR_DELIVERY_QUEUE } from "@modules/queues/calendar-delivery"
import { ProcessCalendarDeliveryStep } from "../../steps/process-calendar-delivery.step"

@Injectable()
/** Consumes the committed calendar receipt using the app's existing fenced job runner. */
export class CalendarDeliveryProcessor extends FencedProcessor {
    readonly queue = CALENDAR_DELIVERY_QUEUE

    constructor(private readonly delivery: ProcessCalendarDeliveryStep) {
        super()
    }

    /** Refuses malformed messages and stale claims before resolving the pending receipt. */
    async process(job: ClaimedJob): Promise<void> {
        await this.delivery.run(job)
    }
}
