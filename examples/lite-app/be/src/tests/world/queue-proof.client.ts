import { SchedulerClient } from "@modules/platform/jobs"
import type { EntityManager } from "typeorm"
import { FakeClock, mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { BookingReminderQueue, BOOKING_REMINDER_QUEUE } from "@modules/queues/booking-reminder"
import {
    QueueInspectionClient,
    PgmqQueueTransportClient,
    QueueOutboxService,
    QueueRelayService,
    READ_BOOKING_OUTBOX,
    type QueueOptions,
    type BookingOutboxRow,
} from "@modules/platform/queue"
import { createQueueBuilder } from "../fixtures/builders/queue.builder"
import type { TestDatabases } from "./use-test-world"

/** Composes the real enqueue and relay collaborators and reads their committed state. */
export const createQueueProof = (db: TestDatabases, options: QueueOptions) => {
    const inspection = new QueueInspectionClient()
    const scheduler = new SchedulerClient()
    const transport = new PgmqQueueTransportClient(options, db.primary, mock<Logger>())
    return {
        builder: createQueueBuilder(db.primary, db.owner, db.reapplyBookingSchedule),
        transport,
        producer: new BookingReminderQueue(new QueueOutboxService(transport, new FakeClock())),
        relay: () => new QueueRelayService(options, [db.primary], transport, new FakeClock(), mock<Logger>()),
        outboxRows: (manager: EntityManager, bookingId: string) =>
            manager.query<Array<BookingOutboxRow>>(READ_BOOKING_OUTBOX, [BOOKING_REMINDER_QUEUE, bookingId]),
        messages: async (manager: EntityManager, bookingId: string) =>
            (await inspection.messages(manager, BOOKING_REMINDER_QUEUE)).filter(
                (row) => row.message.payload.bookingId === bookingId,
            ),
        schedules: (tx: EntityManager) => scheduler.schedules(tx),
        scheduleIds: async (tx: EntityManager) => (await scheduler.schedules(tx)).map(({ jobid }) => ({ jobid })),
        countTicks: async (tx: EntityManager) =>
            (await inspection.messages(tx, BOOKING_REMINDER_QUEUE)).filter((row) => row.message.payload.tick === true)
                .length,
        tickCommand: scheduler.tickCommand,
    }
}
