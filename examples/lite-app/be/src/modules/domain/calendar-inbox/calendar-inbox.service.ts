import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { CalendarsService } from "@modules/domain/calendars"
import { InjectPrimaryEntityManager, recordWebhookDelivery } from "@modules/platform/database"
import { CalendarDeliveryQueue, isCalendarDeliveryRecorded } from "@modules/queues/calendar-delivery"
import {
    COMPLETE_CALENDAR_INBOX,
    FIND_PENDING_CALENDAR_INBOX,
    INSERT_CALENDAR_INBOX,
} from "./persistence/calendar-inbox.sql"

interface CalendarDelivery {
    readonly id: string
}

type CalendarDeliveryId = string | undefined

interface PendingCalendarReceipt {
    readonly id: string
    readonly payload: CalendarDelivery
}

@Injectable()
/** Records each calendar delivery and its typed queue outbox message atomically; processing follows commit. */
export class CalendarInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly recorded: CalendarDeliveryQueue,
        private readonly deliveries: CalendarsService,
    ) {}

    /** A duplicate is acknowledged without publishing another job or invoking the domain intake. */
    acceptCalendarDelivery(deliveryId: CalendarDeliveryId, delivery: CalendarDelivery): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
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

    /** A deferred job locks the committed receipt; completed or concurrently consumed receipts cannot repeat the effect. */
    processCalendarDelivery(receipt: string): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const [pending] = await manager.query<Array<PendingCalendarReceipt>>(FIND_PENDING_CALENDAR_INBOX, [receipt])
            if (pending === undefined) return
            await this.deliveries.acceptCalendarDelivery(pending.payload, manager)
            await manager.query(COMPLETE_CALENDAR_INBOX, [pending.id])
        })
    }
}
