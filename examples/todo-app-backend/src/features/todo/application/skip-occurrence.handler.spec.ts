import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { RecurErrorCode } from "@modules/domain/recur"
import type { OccurrenceService, OccurrenceView } from "@modules/domain/recur"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { SkipOccurrenceCommand } from "./skip-occurrence.command"
import { SkipOccurrenceHandler } from "./skip-occurrence.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "o1", roles: ["member"] }
const skipped: OccurrenceView = {
    id: "t1",
    ruleId: "r1",
    windowKey: "r1:2026-09-30",
    localDate: "2026-09-30",
    dueAtUtc: AT,
    status: "skipped",
}

const build = (skip: jest.Mock): { handler: SkipOccurrenceHandler; occurrences: OccurrenceService; inner: ReturnType<typeof mockEntityManager> } => {
    const inner = mockEntityManager()
    const occurrences = mock<OccurrenceService>({ skip })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new SkipOccurrenceHandler(mock<Logger>(), entityManager, new FakeClock(AT), occurrences), occurrences, inner }
}

describe("SkipOccurrenceHandler", () => {
    it("skips the occurrence for its owner in one transaction", async () => {
        const { handler, occurrences, inner } = build(jest.fn().mockResolvedValue({ kind: "ok", value: skipped }))
        const result = await handler.execute(new SkipOccurrenceCommand({ request: { occurrenceId: "t1" }, principal }))
        expect(result).toEqual({ kind: "ok", value: { occurrenceId: "t1", status: "skipped" } })
        expect(occurrences.skip).toHaveBeenCalledWith({ manager: inner, id: "t1", actorId: "o1", at: AT })
    })

    it("returns the refusal for an unknown occurrence", async () => {
        const { handler } = build(jest.fn().mockResolvedValue({ kind: "refused", code: RecurErrorCode.OccurrenceNotFound }))
        const result = await handler.execute(new SkipOccurrenceCommand({ request: { occurrenceId: "nope" }, principal }))
        expect(result).toMatchObject({ kind: "refused", code: RecurErrorCode.OccurrenceNotFound })
    })
})
