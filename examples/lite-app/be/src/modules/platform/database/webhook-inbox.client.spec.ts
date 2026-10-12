import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { sql } from "./database.sql"
import { DatabaseErrorCode } from "./errors/database.error"
import { acceptWebhookDelivery } from "./webhook-inbox.client"

const INSERT = sql`INSERT INTO public.spec_inbox (provider, delivery_id, payload) VALUES ($1, $2, $3::jsonb) RETURNING id`
const COMPLETE = sql`UPDATE public.spec_inbox SET processed_at = now() WHERE id = $1 RETURNING id`

const build = (claimed: ReadonlyArray<{ id: string }>) =>
    fakeTransaction(
        mockEntityManager({
            query: [
                [INSERT, claimed],
                [COMPLETE, claimed],
            ],
        }),
    )

const accept = (entityManager: EntityManager, deliveryId: string | undefined, intake: jest.Mock) =>
    acceptWebhookDelivery({
        entityManager,
        insert: INSERT,
        complete: COMPLETE,
        provider: "calendar",
        deliveryId,
        payload: { id: "calendar-1" },
        process: intake,
    })

describe("acceptWebhookDelivery", () => {
    it("claims a new delivery by its trimmed id, processes it in the transaction and marks it complete", async () => {
        const tx = build([{ id: "inbox-1" }])
        const intake = jest.fn().mockResolvedValue(undefined)

        await accept(tx.em, "  delivery-1  ", intake)

        expect(tx.commits).toBe(1)
        expect(tx.em.query).toHaveBeenNthCalledWith(1, INSERT, [
            "calendar",
            "delivery-1",
            JSON.stringify({ id: "calendar-1" }),
        ])
        expect(intake).toHaveBeenCalledTimes(1)
        expect(tx.em.query).toHaveBeenNthCalledWith(2, COMPLETE, ["inbox-1"])
    })

    it("acknowledges a redelivery without processing it again", async () => {
        const tx = build([])
        const intake = jest.fn().mockResolvedValue(undefined)

        await accept(tx.em, "delivery-1", intake)

        expect(tx.commits).toBe(1)
        expect(intake).not.toHaveBeenCalled()
        expect(tx.em.query).toHaveBeenCalledTimes(1)
    })

    it("rolls the claim back when processing fails", async () => {
        const tx = build([{ id: "inbox-1" }])
        const failure = new TypeError("intake failed")
        const intake = jest.fn().mockRejectedValue(failure)

        await expect(accept(tx.em, "delivery-1", intake)).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
        expect(tx.em.query).toHaveBeenCalledTimes(1)
    })

    it.each([undefined, "", "   "])(
        "refuses a delivery without an id (%p) before touching the database",
        async (id) => {
            const tx = build([{ id: "inbox-1" }])
            const intake = jest.fn().mockResolvedValue(undefined)

            await expect(accept(tx.em, id, intake)).rejects.toMatchObject({
                code: DatabaseErrorCode.WebhookDeliveryIdRequired,
            })

            expect(tx.outcomes).toEqual([])
            expect(intake).not.toHaveBeenCalled()
        },
    )
})
