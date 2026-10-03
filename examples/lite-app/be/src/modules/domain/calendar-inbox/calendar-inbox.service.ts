import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { CalendarsService } from "@modules/domain/calendars"
import { acceptWebhookDelivery, InjectPrimaryEntityManager } from "@modules/platform/database"
import { COMPLETE_CALENDAR_INBOX, INSERT_CALENDAR_INBOX } from "./persistence/calendar-inbox.sql"

interface CalendarDelivery {
    readonly id: string
}

type CalendarDeliveryId = string | undefined

@Injectable()
/** Claims each calendar delivery once, then runs the domain intake and completion marker in the same transaction. */
export class CalendarInboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly deliveries: CalendarsService,
    ) {}

    /** A duplicate is acknowledged without invoking the domain intake a second time. */
    acceptCalendarDelivery(deliveryId: CalendarDeliveryId, delivery: CalendarDelivery): Promise<void> {
        return acceptWebhookDelivery({
            entityManager: this.entityManager,
            insert: INSERT_CALENDAR_INBOX,
            complete: COMPLETE_CALENDAR_INBOX,
            provider: "calendar",
            deliveryId,
            payload: delivery,
            process: (manager) => this.deliveries.acceptCalendarDelivery(delivery, manager),
        })
    }
}
