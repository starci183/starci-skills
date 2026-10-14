import type { EntityManager } from "typeorm"
import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"
import type { SqlText } from "./database.sql"

interface RecordWebhookDelivery {
    readonly manager: EntityManager
    readonly insert: SqlText
    readonly provider: string
    readonly deliveryId: string | undefined
    readonly payload: object
}

type WebhookReceiptId = string | undefined

/**
 * Records one pending delivery using the intake's transaction manager and returns its durable receipt identity.
 * Business processing and the completion marker belong to the reactor or job that consumes the committed row.
 */
export const recordWebhookDelivery = async ({
    manager,
    insert,
    provider,
    deliveryId,
    payload,
}: RecordWebhookDelivery): Promise<WebhookReceiptId> => {
    const normalizedDeliveryId = deliveryId?.trim()
    if (!normalizedDeliveryId) {
        throw new DatabaseError({ code: DatabaseErrorCode.WebhookDeliveryIdRequired })
    }
    const rows: Array<{ readonly id: string }> = await manager.query(insert, [
        provider,
        normalizedDeliveryId,
        JSON.stringify(payload),
    ])
    return rows[0]?.id
}
