import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { RecurErrorCode } from "@modules/domain/recur"
import type { OccurrenceService } from "@modules/domain/recur"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { CompleteOccurrenceCommand } from "./complete-occurrence.command"
import { CompleteOccurrenceHandler } from "./complete-occurrence.handler"

type OccurrenceView = Awaited<ReturnType<OccurrenceService["materialise"]>>

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "o1", roles: ["member"] }
const completed: OccurrenceView = {
    id: "t1",
    ruleId: "r1",
    windowKey: "r1:2026-09-30",
    localDate: "2026-09-30",
    dueAtUtc: AT,
    status: "completed",
}

/** What `build` wires: the handler and the doubles the specs assert on. */
interface Built {
    handler: CompleteOccurrenceHandler
    occurrences: OccurrenceService
    inner: ReturnType<typeof mockEntityManager>
}

const build = (complete: jest.Mock): Built => {
    const inner = mockEntityManager()
    const occurrences = mock<OccurrenceService>({ complete })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new CompleteOccurrenceHandler(mock<Logger>(), entityManager, new FakeClock(AT), occurrences), occurrences, inner }
}

describe("CompleteOccurrenceHandler", () => {
    it("completes the occurrence for its owner at the stamped instant, in one transaction", async () => {
        const { handler, occurrences, inner } = build(jest.fn().mockResolvedValue({ kind: "ok", value: completed }))
        const result = await handler.execute(new CompleteOccurrenceCommand({ request: { occurrenceId: "t1" }, principal }))
        expect(result).toEqual({ kind: "ok", value: { occurrenceId: "t1", status: "completed" } })
        expect(occurrences.complete).toHaveBeenCalledWith({ manager: inner, id: "t1", actorId: "o1", at: AT })
    })

    it("returns the refusal for a stranger", async () => {
        const { handler } = build(jest.fn().mockResolvedValue({ kind: "refused", code: RecurErrorCode.OccurrenceForbidden }))
        const result = await handler.execute(
            new CompleteOccurrenceCommand({ request: { occurrenceId: "t1" }, principal: { id: "stranger", roles: ["member"] } }),
        )
        expect(result).toMatchObject({ kind: "refused", code: RecurErrorCode.OccurrenceForbidden })
    })
})
