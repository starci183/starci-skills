import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import { PLATFORM_AT, PLATFORM_LATER } from "@tests/fixtures/builders/platform.builder"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PostgresOutbox } from "./outbox.service"
import { BURY_MESSAGE, CLAIM_DUE_MESSAGES, COMPLETE_MESSAGE, INSERT_MESSAGE, RETRY_MESSAGE } from "./persistence/outbox.sql"

const build = async (own = mockEntityManager()) => {
    const clock = new FakeClock(PLATFORM_AT)
    const moduleRef = await Test.createTestingModule({
        providers: [PostgresOutbox, { provide: PRIMARY_ENTITY_MANAGER, useValue: own }, { provide: CLOCK, useValue: clock }],
    }).compile()
    return { outbox: moduleRef.get(PostgresOutbox), own, clock }
}

describe("PostgresOutbox", () => {
    describe("enqueue", () => {
        it("inserts the message through the manager of the caller transaction, stamped with the clock", async () => {
            const { outbox, own, clock } = await build()
            const inTransaction = mockEntityManager({ query: [INSERT_MESSAGE, []] })

            await outbox.enqueue(inTransaction, { queue: "audit.append", eventId: "e-1", payload: { a: 1 }, availableAt: PLATFORM_LATER })

            expect(inTransaction.query).toHaveBeenCalledWith(INSERT_MESSAGE, [
                expect.any(String),
                "audit.append",
                "e-1",
                { a: 1 },
                PLATFORM_LATER,
                clock.now(),
            ])
            expect(own.query).not.toHaveBeenCalled()
        })
    })

    describe("claimDue", () => {
        it("claims the due messages of the queues and maps the rows to records", async () => {
            const rows = [{ id: "m-1", queue: "q", event_id: "e-1", payload: { a: 1 }, attempts: 1 }]
            const own = mockEntityManager({ query: [CLAIM_DUE_MESSAGES, [rows, 1]] })
            const { outbox } = await build(own)
            const at = new Date(PLATFORM_AT)

            await expect(outbox.claimDue({ at, queues: ["q"], limit: 10, visibilityMs: 30_000 })).resolves.toEqual([
                { id: "m-1", queue: "q", eventId: "e-1", payload: { a: 1 }, attempts: 1 },
            ])
            expect(own.query).toHaveBeenCalledWith(CLAIM_DUE_MESSAGES, [at, ["q"], 10, new Date("2026-05-01T10:00:30.000Z")])
        })

        it("answers an empty list when nothing is due", async () => {
            const { outbox } = await build(mockEntityManager({ query: [CLAIM_DUE_MESSAGES, [[], 0]] }))

            await expect(outbox.claimDue({ at: new Date(PLATFORM_AT), queues: ["q"], limit: 10, visibilityMs: 1 })).resolves.toEqual([])
        })
    })

    describe("complete", () => {
        it("marks the message delivered", async () => {
            const own = mockEntityManager({ query: [COMPLETE_MESSAGE, []] })
            const { outbox } = await build(own)

            await outbox.complete("m-1")

            expect(own.query).toHaveBeenCalledWith(COMPLETE_MESSAGE, ["m-1"])
        })
    })

    describe("retry", () => {
        it("schedules the next delivery with the failure", async () => {
            const own = mockEntityManager({ query: [RETRY_MESSAGE, []] })
            const { outbox } = await build(own)

            await outbox.retry({ id: "m-1", at: PLATFORM_LATER, error: "Error: boom" })

            expect(own.query).toHaveBeenCalledWith(RETRY_MESSAGE, ["m-1", PLATFORM_LATER, "Error: boom"])
        })
    })

    describe("bury", () => {
        it("stops delivering the message and keeps the last failure", async () => {
            const own = mockEntityManager({ query: [BURY_MESSAGE, []] })
            const { outbox } = await build(own)

            await outbox.bury({ id: "m-1", error: "Error: boom" })

            expect(own.query).toHaveBeenCalledWith(BURY_MESSAGE, ["m-1", "Error: boom"])
        })
    })
})
