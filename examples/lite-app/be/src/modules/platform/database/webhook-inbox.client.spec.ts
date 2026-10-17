import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { sql } from "./database.sql"
import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"
import { recordWebhookDelivery } from "./webhook-inbox.client"

const INSERT = sql`INSERT INTO public.spec_inbox (provider, delivery_id, payload) VALUES ($1, $2, $3::jsonb) RETURNING id`

const build = (claimed: ReadonlyArray<{ id: string }>) =>
    fakeTransaction(
        mockEntityManager({
            query: [[INSERT, claimed]],
        }),
    )

const record = async (manager: EntityManager, deliveryId: string | undefined) => {
    const subject = await buildSubject()
    return subject({
        manager,
        insert: INSERT,
        provider: "calendar",
        deliveryId,
        payload: { id: "calendar-1" },
    })
}

const SUBJECT: unique symbol = Symbol("database.webhook-inbox")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => recordWebhookDelivery }],
    }).compile()
    return moduleRef.get<typeof recordWebhookDelivery>(SUBJECT)
}

describe("recordWebhookDelivery", () => {
    it("returns the pending receipt without completing it or starting a transaction", async () => {
        const tx = build([{ id: "inbox-1" }])

        await expect(record(tx.em, "  delivery-1  ")).resolves.toBe("inbox-1")

        expect(tx.outcomes).toEqual([])
        expect(tx.em.query).toHaveBeenCalledTimes(1)
        expect(tx.em.query).toHaveBeenCalledWith(INSERT, [
            "calendar",
            "delivery-1",
            JSON.stringify({ id: "calendar-1" }),
        ])
    })

    it("returns no receipt for a duplicate delivery", async () => {
        const tx = build([])

        await expect(record(tx.em, "delivery-1")).resolves.toBeUndefined()

        expect(tx.outcomes).toEqual([])
        expect(tx.em.query).toHaveBeenCalledTimes(1)
    })

    it("lets the caller atomically roll a recorded receipt back with its handoff", async () => {
        const tx = build([{ id: "inbox-1" }])
        const failure = new DatabaseError({ code: DatabaseErrorCode.IdentifierRejected })

        await expect(
            tx.em.transaction(async (manager) => {
                await record(manager, "delivery-1")
                throw failure
            }),
        ).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
        expect(tx.committedWrites).toEqual([])
        expect(tx.rolledBackWrites).toHaveLength(1)
        expect(tx.em.query).toHaveBeenCalledTimes(1)
    })

    it.each([undefined, "", "   "])(
        "refuses a receipt without a delivery id (%p) before touching the database",
        async (id) => {
            const tx = build([{ id: "inbox-1" }])

            await expect(record(tx.em, id)).rejects.toMatchObject({
                code: DatabaseErrorCode.WebhookDeliveryIdRequired,
            })

            expect(tx.outcomes).toEqual([])
            expect(tx.em.query).not.toHaveBeenCalled()
        },
    )
})
