import type { EntityManager } from "typeorm"
import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"
import type { SqlText } from "./database.sql"

interface RecordWebhookDelivery {
    readonly entityManager: EntityManager
    readonly insert: SqlText
    readonly provider: string
    readonly deliveryId: string | undefined
    readonly payload: object
}

/**
 * Records one pending delivery in one EntityManager transaction. The conflict-safe insert keeps redelivery a no-op.
 * Business processing and the completion marker belong to the reactor or job that consumes the committed row.
 */
export const recordWebhookDelivery = async ({
    entityManager,
    insert,
    provider,
    deliveryId,
    payload,
}: RecordWebhookDelivery): Promise<void> => {
    const normalizedDeliveryId = deliveryId?.trim()
    if (!normalizedDeliveryId) {
        throw new DatabaseError({ code: DatabaseErrorCode.WebhookDeliveryIdRequired })
    }
    await entityManager.transaction(async (manager) => {
        await manager.query(insert, [
            provider,
            normalizedDeliveryId,
            JSON.stringify(payload),
        ])
    })
}
