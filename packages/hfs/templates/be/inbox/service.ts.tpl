import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, recordWebhookDelivery } from "@modules/platform/database"
import { @@Provider@@DeliveryRecordedEvent } from "@modules/events/@@provider@@"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { INSERT_@@providerUpper@@_INBOX } from "./persistence/@@provider@@-inbox.sql"

interface @@Provider@@Delivery {
    readonly id: string
}

interface @@Provider@@DeliveryRequest {
    readonly eventId: string | undefined
    readonly delivery: @@Provider@@Delivery
}

@Injectable()
/** Records each @@provider@@ delivery once. Pending rows are consumed by a separate reactor or job after commit. */
export class @@Provider@@InboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectEventBus() private readonly eventBus: EventBus,
    ) {}

    /** A duplicate is acknowledged without creating another pending row; this intake never dispatches a command. */
    record@@Provider@@Delivery(request: @@Provider@@DeliveryRequest): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            if (!(await this.inbox.claim("webhook.@@provider@@", request.eventId, manager))) return
            const receiptId = await recordWebhookDelivery({
                manager,
                insert: INSERT_@@providerUpper@@_INBOX,
                provider: "@@provider@@",
                deliveryId: request.eventId,
                payload: request.delivery,
            })
            if (receiptId === undefined) return
            await this.eventBus.publish(@@Provider@@DeliveryRecordedEvent.create({ receiptId }), manager)
        })
    }
}
