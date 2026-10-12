import { Injectable } from "@nestjs/common"
import { BookingsService } from "@modules/domain/bookings"
import type { QueueDelivery } from "@modules/platform/queue"

@Injectable()
/** The one effect of the job: the pending booking of the delivery becomes confirmed (a repeated delivery changes nothing). */
export class MarkConfirmedStep {
    constructor(private readonly bookings: BookingsService) {}

    /** Confirms the booking the payload names. */
    async run(delivery: QueueDelivery): Promise<void> {
        await this.bookings.confirmBooking(delivery.payload)
    }
}
