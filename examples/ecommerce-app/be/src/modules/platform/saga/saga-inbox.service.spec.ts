import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
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
