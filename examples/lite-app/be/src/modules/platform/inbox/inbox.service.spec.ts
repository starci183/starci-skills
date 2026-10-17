import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { DatabaseError, DatabaseErrorCode } from "@modules/platform/database"
import { PostgresInbox } from "./inbox.service"
import { CLAIM_EVENT } from "./persistence/inbox.sql"

describe("PostgresInbox", () => {
    const build = async () => {
        const module = await Test.createTestingModule({ providers: [PostgresInbox] }).compile()
        return module.get(PostgresInbox)
    }

    it("claims a normalized delivery id through the caller's transaction", async () => {
        const subject = await build()
        const transaction = fakeTransaction(mockEntityManager({ query: [CLAIM_EVENT, [{ event_id: "delivery-1" }]] }))

        const fresh = await transaction.em.transaction((manager) =>
            subject.claim("webhook:spec", "  delivery-1  ", manager),
        )

        expect(fresh).toBe(true)
        expect(transaction.em.query).toHaveBeenCalledWith(CLAIM_EVENT, ["webhook:spec", "delivery-1"])
        expect(transaction.commits).toBe(1)
    })

    it("returns false when the source and event id have already been claimed", async () => {
        const subject = await build()
        const manager = mockEntityManager({ query: [CLAIM_EVENT, []] })

        await expect(subject.claim("webhook:spec", "delivery-1", manager)).resolves.toBe(false)

        expect(manager.query).toHaveBeenCalledTimes(1)
    })

    it("rolls the claim back when later work in the receipt transaction fails", async () => {
        const subject = await build()
        const transaction = fakeTransaction(mockEntityManager({ query: [CLAIM_EVENT, [{ event_id: "delivery-1" }]] }))
        const failure = new DatabaseError({ code: DatabaseErrorCode.IdentifierRejected })

        await expect(
            transaction.em.transaction(async (manager) => {
                expect(await subject.claim("webhook:spec", "delivery-1", manager)).toBe(true)
                throw failure
            }),
        ).rejects.toBe(failure)

        expect(transaction.commits).toBe(0)
        expect(transaction.rollbacks).toBe(1)
        expect(transaction.committedWrites).toEqual([])
        expect(transaction.rolledBackWrites).toHaveLength(1)
    })

    it.each([
        ["no", undefined],
        ["a blank", "   "],
    ])("refuses %s delivery id before writing a claim", async (_label, eventId) => {
        const subject = await build()
        const manager = mockEntityManager()

        await expect(subject.claim("webhook:spec", eventId, manager)).rejects.toMatchObject({
            code: DatabaseErrorCode.WebhookDeliveryIdRequired,
        })

        expect(manager.query).not.toHaveBeenCalled()
    })
})
