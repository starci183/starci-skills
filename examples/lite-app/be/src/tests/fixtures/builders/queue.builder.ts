import type { EntityManager } from "typeorm"
import { BOOKING_REMINDER_QUEUE } from "@modules/queues/booking-reminder"
import {
    INSERT_PENDING_BOOKING,
    DELETE_BOOKING_MESSAGES,
    DELETE_BOOKING_OUTBOX,
    REGISTER_BOOKING_SCHEDULE,
    RUN_BOOKING_TICK,
} from "@modules/platform/queue"
import type { OutboxIdRow, ScheduleRow } from "@modules/platform/queue"

/** SQL-side outbox arrangements and cleanup on the world's connection. */
export const createQueueBuilder = (manager: EntityManager) => ({
    async pendingBooking(bookingId: string): Promise<OutboxIdRow | undefined> {
        const rows = await manager.query<Array<OutboxIdRow>>(INSERT_PENDING_BOOKING, [
            BOOKING_REMINDER_QUEUE,
            JSON.stringify({ bookingId }),
        ])
        return rows[0]
    },
    registerSchedule(tx: EntityManager, job: ScheduleRow): Promise<Array<{ jobid: string }>> {
        return tx.query(REGISTER_BOOKING_SCHEDULE, ["booking_reminder_tick", job.schedule, job.command])
    },
    async tick(tx: EntityManager): Promise<void> {
        await tx.query(RUN_BOOKING_TICK)
    },
    async cleanup(bookingIds: ReadonlyArray<string>): Promise<void> {
        await manager.query(DELETE_BOOKING_MESSAGES, [bookingIds])
        await manager.query(DELETE_BOOKING_OUTBOX, [bookingIds])
    },
})
