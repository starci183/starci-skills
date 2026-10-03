import type { EntityManager } from "typeorm"
import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"
import type { SqlText } from "./database.sql"

interface WebhookInboxStatements {
    readonly insert: SqlText
    readonly complete: SqlText
}

interface AcceptWebhookDelivery extends WebhookInboxStatements {
    readonly entityManager: EntityManager
    readonly provider: string
    readonly deliveryId: string | undefined
    readonly payload: object
    readonly process: (manager: EntityManager) => Promise<void>
}

interface InboxIdentity {
    readonly id: string
}

/**
 * Claims and processes one delivery in one EntityManager transaction. A conflict returns without calling `process`, so
 * a redelivery receives the original empty acknowledgement and cannot repeat the domain mutation.
 */
export const acceptWebhookDelivery = async ({
    entityManager,
    insert,
    complete,
    provider,
    deliveryId,
    payload,
    process,
}: AcceptWebhookDelivery): Promise<void> => {
    const normalizedDeliveryId = deliveryId?.trim()
    if (!normalizedDeliveryId) {
        throw new DatabaseError({ code: DatabaseErrorCode.WebhookDeliveryIdRequired })
    }
    await entityManager.transaction(async (manager) => {
        const claimed = await manager.query<Array<InboxIdentity>>(insert, [
            provider,
            normalizedDeliveryId,
            JSON.stringify(payload),
        ])
        const identity = claimed[0]
        if (identity === undefined) return
        await process(manager)
        await manager.query(complete, [identity.id])
    })
}
