import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { FakeClock } from "@starci/jest-preset"
import { CalendarWebhook } from "@features/webhooks/calendar"
import { CalendarDeliveryProcessor, ProcessCalendarDeliveryStep } from "@features/jobs/calendar-delivery"
import { CalendarInboxService } from "@modules/domain/calendar-inbox"
import type { CalendarsService } from "@modules/domain/calendars"
import { INBOX, InboxModule } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { WebhookSignatureService } from "@modules/platform/http-security"
import type { HttpSecurityOptions } from "@modules/platform/http-security"
import type { JobClaims } from "@modules/platform/jobs"
import type { Logger } from "@modules/platform/logging"
import {
    PgmqQueueTransportClient,
    QueueOutboxService,
    READ_CALENDAR_RECEIPTS,
    READ_CALENDAR_JOBS,
    READ_CALENDAR_MESSAGES,
    READ_CALENDAR_PROCESSED,
} from "@modules/platform/queue"
import type {
    QueueOptions,
    CalendarReceiptRow,
    RecordedJobRow,
    CalendarMessageRow,
    CalendarProcessedRow,
} from "@modules/platform/queue"
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
        builder: createCalendarBuilder(db.primary),
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
        messages: (jobId: string) => db.primary.query<Array<CalendarMessageRow>>(READ_CALENDAR_MESSAGES, [jobId]),
        processed: (receiptId: string) =>
            db.primary.query<Array<CalendarProcessedRow>>(READ_CALENDAR_PROCESSED, [receiptId]),
    }
}
