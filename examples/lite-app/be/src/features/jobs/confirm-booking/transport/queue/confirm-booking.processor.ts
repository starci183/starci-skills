import { Injectable } from "@nestjs/common"
import type { QueueDelivery, QueueHandler } from "@modules/platform/queue"
import { BOOKING_CONFIRMATION_QUEUE } from "@modules/queues/booking-confirmation"
import { MarkConfirmedStep } from "../../steps/mark-confirmed.step"

@Injectable()
/** The processor of the confirm-booking job: the pgmq worker reads, retries and archives the message; `handle` delegates to the one step. */
export class ConfirmBookingProcessor implements QueueHandler {
    readonly queue = BOOKING_CONFIRMATION_QUEUE

    constructor(private readonly markConfirmed: MarkConfirmedStep) {}

    /** Confirms the booking; a throw leaves the message to the worker's retry. */
    async handle(delivery: QueueDelivery): Promise<void> {
        await this.markConfirmed.run(delivery)
    }
}
