import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { CLAIM_MANAGERS } from "./inbox.decorators"
import { PostgresInbox } from "./inbox.service"
import { CLAIM_EVENT, RELEASE_EVENT } from "./persistence/inbox.sql"

const build = async (manager: ReturnType<typeof mockEntityManager>) => {
    const clock = new FakeClock("2026-02-03T04:05:06.000Z")
    const moduleRef = await Test.createTestingModule({
        providers: [
            PostgresInbox,
            { provide: CLAIM_MANAGERS, useValue: [manager] },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return moduleRef.get(PostgresInbox)
}

describe("PostgresInbox", () => {
    describe("claim", () => {
        it("answers true for the first claim, stamped with the clock", async () => {
            const manager = mockEntityManager({ query: [CLAIM_EVENT, [{ event_id: "e-1" }]] })
            const inbox = await build(manager)

            await expect(inbox.claim("payments", "e-1")).resolves.toBe(true)
            expect(manager.query).toHaveBeenCalledWith(CLAIM_EVENT, [
                "payments",
                "e-1",
                new FakeClock("2026-02-03T04:05:06.000Z").now(),
            ])
        })

        it("uses the supplied transaction manager for the claim query without reaching the configured manager", async () => {
            const configured = mockEntityManager()
            const tx = fakeTransaction(mockEntityManager({ query: [CLAIM_EVENT, [{ event_id: "e-1" }]] }))
            const inbox = await build(configured)

            await expect(tx.em.transaction((manager) => inbox.claim("payments", "e-1", manager))).resolves.toBe(true)

            const params = ["payments", "e-1", new FakeClock("2026-02-03T04:05:06.000Z").now()]
            expect(tx.em.query).toHaveBeenCalledWith(CLAIM_EVENT, params)
            expect(configured.query).not.toHaveBeenCalled()
            expect(tx.committedWrites).toEqual([{ method: "query", args: [CLAIM_EVENT, params] }])
            expect(tx.commits).toBe(1)
        })

        it("answers false for a duplicate through the supplied manager without falling back to the configured manager", async () => {
            const configured = mockEntityManager()
            const supplied = mockEntityManager({ query: [CLAIM_EVENT, []] })
            const inbox = await build(configured)

            await expect(inbox.claim("payments", "e-1", supplied)).resolves.toBe(false)

            expect(supplied.query).toHaveBeenCalledWith(CLAIM_EVENT, [
                "payments",
                "e-1",
                new FakeClock("2026-02-03T04:05:06.000Z").now(),
            ])
            expect(configured.query).not.toHaveBeenCalled()
        })

        it("propagates the supplied manager query error so its transaction rolls back without root fallback", async () => {
            const failure = new Error("claim statement failed")
            const configured = mockEntityManager()
            const tx = fakeTransaction(mockEntityManager({ query: [CLAIM_EVENT, []] }))
            tx.em.query.mockRejectedValueOnce(failure)
            const inbox = await build(configured)

            await expect(tx.em.transaction((manager) => inbox.claim("payments", "e-1", manager))).rejects.toBe(failure)

            expect(configured.query).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
            expect(tx.commits).toBe(0)
            expect(tx.committedWrites).toEqual([])
        })

        it("answers false when the event was claimed before", async () => {
            const inbox = await build(mockEntityManager({ query: [CLAIM_EVENT, []] }))

            await expect(inbox.claim("payments", "e-1")).resolves.toBe(false)
        })
    })

    describe("release", () => {
        it("deletes the claim of the event", async () => {
            const manager = mockEntityManager({ query: [RELEASE_EVENT, []] })
            const inbox = await build(manager)

            await expect(inbox.release("payments", "e-1")).resolves.toBeUndefined()
            expect(manager.query).toHaveBeenCalledWith(RELEASE_EVENT, ["payments", "e-1"])
        })
    })
})
