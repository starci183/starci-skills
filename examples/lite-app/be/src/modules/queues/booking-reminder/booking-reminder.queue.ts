import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue name: the contract between this producer, the pg_cron tick and the send-reminder job (a pgmq queue name). */
export const BOOKING_REMINDER_QUEUE = "booking_reminder"

/** The payload of one send-reminder job for one booking, enqueued with the booking's transaction. */
export interface BookingReminderPayload {
    /** The booking the reminder is about. */
    readonly bookingId: string
}

/** The payload the pg_cron tick enqueues: the send-reminder job scans the bookings due a reminder itself. */
export interface BookingReminderTick {
    /** Always true: the message only asks for one catch-up pass. */
    readonly tick: true
}

/** True when a job payload is the payload of a send-reminder job for one booking. */
export const isBookingReminderPayload = (value: unknown): value is BookingReminderPayload =>
    typeof value === "object" && value !== null && "bookingId" in value && typeof value.bookingId === "string"

/** True when a job payload is the tick the pg_cron job enqueues. */
export const isBookingReminderTick = (value: unknown): value is BookingReminderTick =>
    typeof value === "object" && value !== null && "tick" in value && value.tick === true

@Injectable()
/** The typed producer of the booking-reminder queue: the one way a send-reminder job for one booking starts. */
export class BookingReminderQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the reminder of a new booking in the caller's transaction: the job exists exactly when the booking commits. */
    enqueueRemindBooking(payload: BookingReminderPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, BOOKING_REMINDER_QUEUE, payload)
    }
}
