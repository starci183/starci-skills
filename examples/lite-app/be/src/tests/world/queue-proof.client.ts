import type { EntityManager } from "typeorm"
import { FakeClock, mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { BookingReminderQueue, BOOKING_REMINDER_QUEUE } from "@modules/queues/booking-reminder"
import {
    PgmqQueueTransportClient,
    QueueOutboxService,
    QueueRelayService,
    READ_BOOKING_OUTBOX,
    READ_BOOKING_MESSAGES,
    READ_BOOKING_SCHEDULE,
    READ_BOOKING_SCHEDULE_ID,
    COUNT_BOOKING_TICKS,
    RUN_BOOKING_TICK,
} from "@modules/platform/queue"
import type {
    QueueOptions,
    BookingOutboxRow,
    BookingMessageRow,
    ScheduleRow,
    TickCountRow,
} from "@modules/platform/queue"
import { createQueueBuilder } from "../fixtures/builders/queue.builder"
import type { TestDatabases } from "./use-test-world"

/** Composes the real enqueue and relay collaborators and reads their committed state. */
export const createQueueProof = (db: TestDatabases, options: QueueOptions) => {
    const transport = new PgmqQueueTransportClient(options, db.primary, mock<Logger>())
    return {
        builder: createQueueBuilder(db.primary),
        transport,
        producer: new BookingReminderQueue(new QueueOutboxService(transport, new FakeClock())),
        relay: () => new QueueRelayService(options, [db.primary], transport, new FakeClock(), mock<Logger>()),
        outboxRows: (manager: EntityManager, bookingId: string) =>
            manager.query<Array<BookingOutboxRow>>(READ_BOOKING_OUTBOX, [BOOKING_REMINDER_QUEUE, bookingId]),
        messages: (manager: EntityManager, bookingId: string) =>
            manager.query<Array<BookingMessageRow>>(READ_BOOKING_MESSAGES, [bookingId]),
        schedules: (tx: EntityManager) =>
            tx.query<Array<ScheduleRow>>(READ_BOOKING_SCHEDULE, ["booking_reminder_tick"]),
        scheduleIds: (tx: EntityManager) =>
            tx.query<Array<Pick<ScheduleRow, "jobid">>>(READ_BOOKING_SCHEDULE_ID, ["booking_reminder_tick"]),
        countTicks: async (tx: EntityManager) => {
            const [row] = await tx.query<Array<TickCountRow>>(COUNT_BOOKING_TICKS)
            return Number(row?.count)
        },
        tickCommand: RUN_BOOKING_TICK,
    }
}
