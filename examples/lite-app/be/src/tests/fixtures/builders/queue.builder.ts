import { SchedulerClient } from "@modules/platform/jobs"
import {
    QueueInspectionClient,
    INSERT_PENDING_BOOKING,
    DELETE_BOOKING_OUTBOX,
    type OutboxIdRow,
} from "@modules/platform/queue"
import type { EntityManager } from "typeorm"
import { BOOKING_REMINDER_QUEUE } from "@modules/queues/booking-reminder"

/** SQL-side outbox arrangements and cleanup on the world's connection. */
export const createQueueBuilder = (manager: EntityManager) => ({
    async pendingBooking(bookingId: string): Promise<OutboxIdRow | undefined> {
        const rows = await manager.query<Array<OutboxIdRow>>(INSERT_PENDING_BOOKING, [
            BOOKING_REMINDER_QUEUE,
            JSON.stringify({ bookingId }),
        ])
        return rows[0]
    },
    registerSchedule(tx: EntityManager): Promise<Array<{ jobid: string }>> {
        return new SchedulerClient().register(tx)
    },
    async tick(tx: EntityManager): Promise<void> {
        await new SchedulerClient().tick(tx)
    },
    async cleanup(bookingIds: ReadonlyArray<string>): Promise<void> {
        await new QueueInspectionClient().cleanup(manager, BOOKING_REMINDER_QUEUE, (row) =>
            bookingIds.includes(String(row.message.payload.bookingId)),
        )
        await manager.query(DELETE_BOOKING_OUTBOX, [bookingIds])
    },
})
