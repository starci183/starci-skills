import { FakeClock } from "@starci/jest-preset/clock"
import { mockEntityManager } from "@tests/fixtures/database"
import { PostgresOutbox } from "./outbox.service"
import { BURY_MESSAGE, CLAIM_DUE_MESSAGES, COMPLETE_MESSAGE, INSERT_MESSAGE, RETRY_MESSAGE } from "./persistence/outbox.sql"

const AT = new Date("2026-09-30T10:00:00.000Z")
const LATER = new Date("2026-09-30T10:05:00.000Z")

describe("PostgresOutbox", () => {
    it("enqueues through the manager of the caller transaction, not its own", async () => {
        const own = mockEntityManager()
        const inTransaction = mockEntityManager({ query: jest.fn().mockResolvedValue([]) })
        await new PostgresOutbox(own, new FakeClock(AT)).enqueue(inTransaction, {
            queue: "audit.append",
            eventId: "e1",
            payload: { a: 1 },
            availableAt: LATER,
        })
        expect(inTransaction.query).toHaveBeenCalledWith(INSERT_MESSAGE, [
            expect.any(String),
            "audit.append",
            "e1",
            { a: 1 },
            LATER,
            AT,
        ])
        expect(own.query).not.toHaveBeenCalled()
    })

    it("publishes on its own manager", async () => {
        const own = mockEntityManager({ query: jest.fn().mockResolvedValue([]) })
        await new PostgresOutbox(own, new FakeClock(AT)).publish({ queue: "q", eventId: "e", payload: {}, availableAt: AT })
        expect(own.query).toHaveBeenCalledWith(INSERT_MESSAGE, expect.any(Array))
    })

    it("maps claimed rows to records and hides them for the visibility window", async () => {
        const own = mockEntityManager({
            query: jest
                .fn()
                .mockResolvedValue([[{ id: "m1", queue: "q", event_id: "e1", payload: { a: 1 }, attempts: 1 }], 1]),
        })
        const records = await new PostgresOutbox(own, new FakeClock(AT)).claimDue({
            at: AT,
            queues: ["q"],
            limit: 10,
            visibilityMs: 300_000,
        })
        expect(records).toEqual([{ id: "m1", queue: "q", eventId: "e1", payload: { a: 1 }, attempts: 1 }])
        expect(own.query).toHaveBeenCalledWith(CLAIM_DUE_MESSAGES, [AT, ["q"], 10, LATER])
    })

    it("completes, retries and buries by id", async () => {
        const own = mockEntityManager({ query: jest.fn().mockResolvedValue([]) })
        const outbox = new PostgresOutbox(own, new FakeClock(AT))
        await outbox.complete("m1")
        await outbox.retry({ id: "m1", at: LATER, error: "boom" })
        await outbox.bury({ id: "m1", error: "gave up" })
        expect(own.query).toHaveBeenCalledWith(COMPLETE_MESSAGE, ["m1"])
        expect(own.query).toHaveBeenCalledWith(RETRY_MESSAGE, ["m1", LATER, "boom"])
        expect(own.query).toHaveBeenCalledWith(BURY_MESSAGE, ["m1", "gave up"])
    })
})
