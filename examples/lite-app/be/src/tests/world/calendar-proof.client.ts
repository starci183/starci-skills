import {
    type CalendarReceiptRow,
    type CalendarProcessedRow,
    READ_CALENDAR_RECEIPTS,
    READ_CALENDAR_PROCESSED,
    CalendarInboxService,
} from "@modules/domain/calendar-inbox"
import {
    QueueInspectionClient,
    PgmqQueueTransportClient,
    QueueOutboxService,
    READ_CALENDAR_JOBS,
    type QueueOptions,
    type RecordedJobRow,
} from "@modules/platform/queue"
import { Test } from "@nestjs/testing"
import { mock, type FakeClock } from "@starci/jest-preset"
import { CalendarWebhook } from "@features/webhooks/calendar"
import { CalendarDeliveryProcessor, ProcessCalendarDeliveryStep } from "@features/jobs/calendar-delivery"
import type { CalendarsService } from "@modules/domain/calendars"
import { INBOX, InboxModule, type Inbox } from "@modules/platform/inbox"
import { WebhookSignatureService, type HttpSecurityOptions } from "@modules/platform/http-security"
import type { JobClaims } from "@modules/platform/jobs"
import type { Logger } from "@modules/platform/logging"
import { CalendarDeliveryQueue, CALENDAR_DELIVERY_QUEUE } from "@modules/queues/calendar-delivery"
import { createCalendarBuilder } from "../fixtures/builders/calendar.builder"
import type { TestDatabases } from "./use-test-world"

/** Boots the actual inbox claim provider and composes the calendar handoff collaborators. */
export const createCalendarProof = async (
    db: TestDatabases,
    clock: FakeClock,
    security: HttpSecurityOptions,
    options: QueueOptions,
) => {
    const context = await Test.createTestingModule({ imports: [InboxModule.register({})] }).compile()
    const transport = new PgmqQueueTransportClient(options, db.primary, mock<Logger>())
    const queue = new CalendarDeliveryQueue(new QueueOutboxService(transport, clock))
    return {
        builder: createCalendarBuilder(db.owner),
        close: () => context.close(),
        doorOf: (inbox: CalendarInboxService) =>
            new CalendarWebhook(new WebhookSignatureService(security, clock), inbox),
        intake: (calendars: CalendarsService) =>
            new CalendarInboxService(db.primary, context.get<Inbox>(INBOX), queue, calendars),
        processor: (inbox: CalendarInboxService, claims: JobClaims) =>
            new CalendarDeliveryProcessor(new ProcessCalendarDeliveryStep(inbox, claims)),
        receipts: (deliveryId: string) =>
            db.primary.query<Array<CalendarReceiptRow>>(READ_CALENDAR_RECEIPTS, ["calendar", deliveryId]),
        jobs: (ids: ReadonlyArray<string>) =>
            db.primary.query<Array<RecordedJobRow>>(READ_CALENDAR_JOBS, [CALENDAR_DELIVERY_QUEUE, ids]),
        messages: async (jobId: string) =>
            (await new QueueInspectionClient().messages(db.primary, CALENDAR_DELIVERY_QUEUE))
                .filter((row) => row.message.jobId === jobId)
                .map(({ message }) => ({ message })),
        processed: (receiptId: string) =>
            db.primary.query<Array<CalendarProcessedRow>>(READ_CALENDAR_PROCESSED, [receiptId]),
    }
}
