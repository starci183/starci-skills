import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue name: the contract between this producer and the processor of the confirm-booking job (a pgmq queue name). */
export const BOOKING_CONFIRMATION_QUEUE = "booking_confirmation"

/** The payload of one confirm-booking job: the new booking, ids only. */
export interface ConfirmBookingPayload {
    /** The booking that waits for its confirmation. */
    readonly bookingId: string
}

/** True when a job payload is the payload of a confirm-booking job. */
export const isConfirmBookingPayload = (value: unknown): value is ConfirmBookingPayload =>
    typeof value === "object" && value !== null && "bookingId" in value && typeof value.bookingId === "string"

@Injectable()
/** The typed producer of the booking-confirmation queue: the one way a confirm-booking job starts. */
export class BookingConfirmationQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the confirmation of a new booking in the caller's transaction: the job exists exactly when the booking commits. */
    enqueueConfirmBooking(payload: ConfirmBookingPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, BOOKING_CONFIRMATION_QUEUE, payload)
    }
}
