import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { CLAIM_SAGA_EVENT, RELEASE_SAGA_EVENT } from "./persistence/saga.sql"
import { SagaInbox } from "./saga-inbox.service"

const AT = "2026-02-03T04:05:06.000Z"

const build = async (manager: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            SagaInbox,
            { provide: ORDER_ENTITY_MANAGER, useValue: manager },
            { provide: CLOCK, useValue: new FakeClock(AT) },
        ],
    }).compile()
    return moduleRef.get(SagaInbox)
}

describe("SagaInbox", () => {
    describe("claim", () => {
        it("answers true for the first claim, stamped with the clock", async () => {
            const manager = mockEntityManager({ query: [CLAIM_SAGA_EVENT, [{ event_id: "e-1" }]] })
            const inbox = await build(manager)

            await expect(inbox.claim("saga:place-order", "e-1")).resolves.toBe(true)
            expect(manager.query).toHaveBeenCalledWith(CLAIM_SAGA_EVENT, ["saga:place-order", "e-1", new Date(AT)])
        })

        it("uses the supplied transaction manager for the same saga claim query and clock stamp without querying the configured manager", async () => {
            const configured = mockEntityManager()
            const tx = fakeTransaction(mockEntityManager({ query: [CLAIM_SAGA_EVENT, [{ event_id: "e-1" }]] }))
            const inbox = await build(configured)

            await expect(tx.em.transaction((manager) => inbox.claim("saga:place-order", "e-1", manager))).resolves.toBe(
                true,
            )

            const params = ["saga:place-order", "e-1", new Date(AT)]
            expect(tx.em.query).toHaveBeenCalledWith(CLAIM_SAGA_EVENT, params)
            expect(configured.query).not.toHaveBeenCalled()
            expect(tx.committedWrites).toEqual([{ method: "query", args: [CLAIM_SAGA_EVENT, params] }])
            expect(tx.commits).toBe(1)
        })

        it("answers false through the supplied manager for a duplicate without querying the configured manager", async () => {
            const configured = mockEntityManager()
            const supplied = mockEntityManager({ query: [CLAIM_SAGA_EVENT, []] })
            const inbox = await build(configured)

            await expect(inbox.claim("saga:place-order", "e-1", supplied)).resolves.toBe(false)

            expect(supplied.query).toHaveBeenCalledWith(CLAIM_SAGA_EVENT, ["saga:place-order", "e-1", new Date(AT)])
            expect(configured.query).not.toHaveBeenCalled()
        })

        it("propagates a supplied manager query error through its transaction without falling back to the configured manager", async () => {
            const failure = new Error("saga claim statement failed")
            const configured = mockEntityManager()
            const tx = fakeTransaction(mockEntityManager({ query: [CLAIM_SAGA_EVENT, []] }))
            tx.em.query.mockRejectedValueOnce(failure)
            const inbox = await build(configured)

            await expect(tx.em.transaction((manager) => inbox.claim("saga:place-order", "e-1", manager))).rejects.toBe(
                failure,
            )

            expect(configured.query).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
            expect(tx.commits).toBe(0)
            expect(tx.committedWrites).toEqual([])
        })

        it("answers false when the event was claimed before", async () => {
            const inbox = await build(mockEntityManager({ query: [CLAIM_SAGA_EVENT, []] }))

            await expect(inbox.claim("saga:place-order", "e-1")).resolves.toBe(false)
        })
    })

    describe("release", () => {
        it("deletes the claim of the event", async () => {
            const manager = mockEntityManager({ query: [RELEASE_SAGA_EVENT, []] })
            const inbox = await build(manager)

            await expect(inbox.release("saga:place-order", "e-1")).resolves.toBeUndefined()
            expect(manager.query).toHaveBeenCalledWith(RELEASE_SAGA_EVENT, ["saga:place-order", "e-1"])
        })
    })
})
