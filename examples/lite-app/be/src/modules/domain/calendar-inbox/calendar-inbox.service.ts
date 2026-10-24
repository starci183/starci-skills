import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { CalendarsService } from "@modules/domain/calendars"
import { InjectPrimaryEntityManager, recordWebhookDelivery } from "@modules/platform/database"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox, InboxEventId } from "@modules/platform/inbox"
import { CalendarDeliveryQueue, isCalendarDeliveryRecorded } from "@modules/queues/calendar-delivery"
import {
    COMPLETE_CALENDAR_INBOX,
    FIND_PENDING_CALENDAR_INBOX,
    INSERT_CALENDAR_INBOX,
} from "./persistence/calendar-inbox.sql"

import { CalendarDeliverySchema } from "./calendar-delivery.schema"
import { CalendarInboxError, CalendarInboxErrorCode } from "./errors/calendar-inbox.error"
import type { CalendarDelivery, PendingCalendarReceipt } from "./types/calendar-delivery.contracts"

@Injectable()
/** Records each calendar delivery and its typed queue outbox message atomically; processing follows commit. */
export class CalendarInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        private readonly recorded: CalendarDeliveryQueue,
        private readonly deliveries: CalendarsService,
    ) {}

    /** A duplicate is acknowledged without publishing another job or invoking the domain intake. */
    acceptCalendarDelivery(deliveryId: InboxEventId, delivery: CalendarDelivery): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            if (!(await this.inbox.claim("webhook.calendar", deliveryId, manager))) return
            const receiptId = await recordWebhookDelivery({
                manager,
                insert: INSERT_CALENDAR_INBOX,
                provider: "calendar",
                deliveryId,
                payload: delivery,
            })
            if (receiptId === undefined) return
            await this.recorded.enqueueDeliveryRecorded({ receiptId }, manager)
        })
    }

    /** Validates the typed queue contract before a deferred job resolves its receipt. */
    processRecordedDelivery(message: object): Promise<void> {
        if (!isCalendarDeliveryRecorded(message)) return Promise.resolve()
        return this.processCalendarDelivery(message.receiptId)
    }

    /** A deferred job locks the committed receipt and reads its retained payload through the delivery schema; completed or concurrently consumed receipts cannot repeat the effect, and a payload that does not read back fails the job before any effect. */
    processCalendarDelivery(receipt: string): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const [pending] = await manager.query<Array<PendingCalendarReceipt>>(FIND_PENDING_CALENDAR_INBOX, [receipt])
            if (pending === undefined) return
            const delivery = CalendarDeliverySchema.safeParse(pending.payload)
            if (!delivery.success)
                throw new CalendarInboxError({ code: CalendarInboxErrorCode.MalformedPayload, cause: delivery.error })
            await this.deliveries.acceptCalendarDelivery(delivery.data, manager)
            await manager.query(COMPLETE_CALENDAR_INBOX, [pending.id])
        })
    }
}
