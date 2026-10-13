import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { sql } from "./database.sql"
import { DatabaseErrorCode } from "./errors/database.error"
import { acceptWebhookDelivery } from "./webhook-inbox.client"

// The client runs whatever claim and completion statements its caller owns; opaque function calls stand in for them here.
const INSERT = sql`SELECT id FROM claim_spec_inbox($1, $2, $3::jsonb)`
const COMPLETE = sql`SELECT id FROM complete_spec_inbox($1)`
const PAYLOAD = { id: "delivery-1" }

const accept = (entityManager: EntityManager, deliveryId: string | undefined, process: (manager: EntityManager) => Promise<void>) =>
    acceptWebhookDelivery({ entityManager, insert: INSERT, complete: COMPLETE, provider: "spec", deliveryId, payload: PAYLOAD, process })

describe("acceptWebhookDelivery", () => {
    it("claims a new delivery, processes it and marks it complete in one committed transaction", async () => {
        const transaction = fakeTransaction(mockEntityManager({ query: [[INSERT, [{ id: "inbox-1" }]], [COMPLETE, [{ id: "inbox-1" }]]] }))
        const process = jest.fn<Promise<void>, [EntityManager]>().mockResolvedValue(undefined)

        await accept(transaction.em, "  delivery-1  ", process)

        expect(process).toHaveBeenCalledTimes(1)
        expect(transaction.em.query).toHaveBeenCalledWith(INSERT, ["spec", "delivery-1", JSON.stringify(PAYLOAD)])
        expect(transaction.em.query).toHaveBeenCalledWith(COMPLETE, ["inbox-1"])
        expect(transaction.commits).toBe(1)
    })

    it("acknowledges a duplicate without processing it again", async () => {
        const transaction = fakeTransaction(mockEntityManager({ query: [INSERT, []] }))
        const process = jest.fn<Promise<void>, [EntityManager]>()

        await accept(transaction.em, "delivery-1", process)

        expect(process).not.toHaveBeenCalled()
        expect(transaction.em.query).toHaveBeenCalledTimes(1)
    })

    it.each([["no", undefined], ["a blank", "   "]])("refuses %s delivery id before opening a transaction", async (_label, deliveryId) => {
        const transaction = fakeTransaction(mockEntityManager())
        const process = jest.fn<Promise<void>, [EntityManager]>()

        await expect(accept(transaction.em, deliveryId, process)).rejects.toMatchObject({ code: DatabaseErrorCode.WebhookDeliveryIdRequired })

        expect(transaction.outcomes).toEqual([])
        expect(process).not.toHaveBeenCalled()
    })
})
