import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, recordWebhookDelivery } from "@modules/platform/database"
import { INSERT_@@providerUpper@@_INBOX } from "./persistence/@@provider@@-inbox.sql"

interface @@Provider@@Delivery {
    readonly id: string
}

type @@Provider@@DeliveryId = string | undefined

@Injectable()
/** Records each @@provider@@ delivery once. Pending rows are consumed by a separate reactor or job after commit. */
export class @@Provider@@InboxService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {}

    /** A duplicate is acknowledged without creating another pending row; this intake never dispatches a command. */
    record@@Provider@@Delivery(deliveryId: @@Provider@@DeliveryId, delivery: @@Provider@@Delivery): Promise<void> {
        return recordWebhookDelivery({
            entityManager: this.entityManager,
            insert: INSERT_@@providerUpper@@_INBOX,
            provider: "@@provider@@",
            deliveryId,
            payload: delivery,
        })
    }
}
