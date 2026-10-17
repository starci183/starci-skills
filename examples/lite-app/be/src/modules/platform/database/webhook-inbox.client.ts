import type { EntityManager } from "typeorm"
import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"
import type { SqlText } from "./database.sql"

interface InboxIdentity {
    readonly id: string
}

interface RecordWebhookDelivery {
    readonly manager: EntityManager
    readonly insert: SqlText
    readonly provider: string
    readonly deliveryId: string | undefined
    readonly payload: object
}

/** Receipt id when inserted, or undefined when the delivery was already recorded. */
export type WebhookDeliveryResult = string | undefined

/** Records a pending receipt in the caller's transaction; its consumer processes it after commit. */
export const recordWebhookDelivery = async ({
    manager,
    insert,
    provider,
    deliveryId,
    payload,
}: RecordWebhookDelivery): Promise<WebhookDeliveryResult> => {
    const normalizedDeliveryId = deliveryId?.trim()
    if (!normalizedDeliveryId) {
        throw new DatabaseError({ code: DatabaseErrorCode.WebhookDeliveryIdRequired })
    }
    const rows = await manager.query<Array<InboxIdentity>>(insert, [
        provider,
        normalizedDeliveryId,
        JSON.stringify(payload),
    ])
    return rows[0]?.id
}
