import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
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
