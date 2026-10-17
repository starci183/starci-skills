import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { DatabaseError, DatabaseErrorCode } from "@modules/platform/database"
import type { Inbox, InboxEventId } from "./inbox.port"
import { CLAIM_EVENT } from "./persistence/inbox.sql"

@Injectable()
/** Claims a delivery with the receipt transaction, so a failure can be retried without losing the delivery. */
export class PostgresInbox implements Inbox {
    /** The first claim wins; the same source and delivery id becomes a no-op on redelivery. */
    async claim(source: string, eventId: InboxEventId, tx: EntityManager): Promise<boolean> {
        const normalizedEventId = eventId?.trim()
        if (!normalizedEventId) {
            throw new DatabaseError({ code: DatabaseErrorCode.WebhookDeliveryIdRequired })
        }
        const rows: Array<object> = await tx.query(CLAIM_EVENT, [source, normalizedEventId])
        return rows.length > 0
    }
}
