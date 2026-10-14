import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { sql } from "./database.sql"
import { DatabaseErrorCode } from "./errors/database.error"
import { recordWebhookDelivery } from "./webhook-inbox.client"

// The caller owns the conflict-safe pending-row insert; an opaque function call stands in for it here.
const INSERT = sql`SELECT id FROM record_spec_inbox($1, $2, $3::jsonb)`
const PAYLOAD = { id: "delivery-1" }

const record = (entityManager: EntityManager, deliveryId: string | undefined) =>
    recordWebhookDelivery({ entityManager, insert: INSERT, provider: "spec", deliveryId, payload: PAYLOAD })

describe("recordWebhookDelivery", () => {
    it("records a new delivery and commits before any business processing", async () => {
        const transaction = fakeTransaction(mockEntityManager({ query: [INSERT, [{ id: "inbox-1" }]] }))

        await record(transaction.em, "  delivery-1  ")

        expect(transaction.em.query).toHaveBeenCalledTimes(1)
        expect(transaction.em.query).toHaveBeenCalledWith(INSERT, ["spec", "delivery-1", JSON.stringify(PAYLOAD)])
        expect(transaction.commits).toBe(1)
    })

    it("acknowledges a duplicate without any completion or business write", async () => {
        const transaction = fakeTransaction(mockEntityManager({ query: [INSERT, []] }))

        await record(transaction.em, "delivery-1")

        expect(transaction.em.query).toHaveBeenCalledTimes(1)
        expect(transaction.commits).toBe(1)
    })

    it.each([["no", undefined], ["a blank", "   "]])("refuses %s delivery id before opening a transaction", async (_label, deliveryId) => {
        const transaction = fakeTransaction(mockEntityManager())

        await expect(record(transaction.em, deliveryId)).rejects.toMatchObject({ code: DatabaseErrorCode.WebhookDeliveryIdRequired })

        expect(transaction.outcomes).toEqual([])
        expect(transaction.em.query).not.toHaveBeenCalled()
    })
})
