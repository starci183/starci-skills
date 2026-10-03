import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { @@service@@ } from "@@serviceModule@@"
import { acceptWebhookDelivery, InjectPrimaryEntityManager } from "@modules/platform/database"
import { COMPLETE_@@providerUpper@@_INBOX, INSERT_@@providerUpper@@_INBOX } from "./persistence/@@provider@@-inbox.sql"

interface @@Provider@@Delivery {
    readonly id: string
}

type @@Provider@@DeliveryId = string | undefined

@Injectable()
/** Claims each @@provider@@ delivery once, then runs the domain intake and completion marker in the same transaction. */
export class @@Provider@@InboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly deliveries: @@service@@,
    ) {}

    /** A duplicate is acknowledged without invoking the domain intake a second time. */
    accept@@Provider@@Delivery(deliveryId: @@Provider@@DeliveryId, delivery: @@Provider@@Delivery): Promise<void> {
        return acceptWebhookDelivery({
            entityManager: this.entityManager,
            insert: INSERT_@@providerUpper@@_INBOX,
            complete: COMPLETE_@@providerUpper@@_INBOX,
            provider: "@@provider@@",
            deliveryId,
            payload: delivery,
            process: (manager) => this.deliveries.accept@@Provider@@Delivery(delivery, manager),
        })
    }
}
