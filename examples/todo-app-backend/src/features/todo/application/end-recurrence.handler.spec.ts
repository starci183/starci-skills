import { mock } from "@starci/jest-preset/mock"
import { RecurErrorCode, RuleFrequency } from "@modules/domain/recur"
import type { OccurrenceService, RuleService, RuleView } from "@modules/domain/recur"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { EndRecurrenceCommand } from "./end-recurrence.command"
import { EndRecurrenceHandler } from "./end-recurrence.handler"

const principal: Principal = { id: "o1", roles: ["member"] }
const ended: RuleView = {
    id: "r1",
    owner: "o1",
    title: "Stand-up",
    frequency: RuleFrequency.EveryWeekday,
    n: null,
    dayOfMonth: null,
    timeZone: "Asia/Ho_Chi_Minh",
    time: "09:00",
    startDate: "2026-09-01",
    endedAt: "2026-09-20",
}

/** What `build` wires: the handler and the doubles the specs assert on. */
interface Built {
    handler: EndRecurrenceHandler
    rules: RuleService
    occurrences: OccurrenceService
    inner: ReturnType<typeof mockEntityManager>
}

const build = (
    end: jest.Mock,
): Built => {
    const inner = mockEntityManager()
    const rules = mock<RuleService>({ end })
    const occurrences = mock<OccurrenceService>({ orphanEnded: jest.fn().mockResolvedValue(2) })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new EndRecurrenceHandler(mock<Logger>(), entityManager, rules, occurrences), rules, occurrences, inner }
}

describe("EndRecurrenceHandler", () => {
    it("ends the rule and orphans its still materialised occurrences from that day on, in one transaction", async () => {
        const { handler, rules, occurrences, inner } = build(jest.fn().mockResolvedValue({ kind: "ok", value: ended }))
        const result = await handler.execute(
            new EndRecurrenceCommand({ request: { ruleId: "r1", endedAt: "2026-09-20" }, principal }),
        )
        expect(result).toEqual({ kind: "ok", value: { ruleId: "r1", endedAt: "2026-09-20", orphanedCount: 2 } })
        expect(rules.end).toHaveBeenCalledWith({ manager: inner, id: "r1", actorId: "o1", endedAt: "2026-09-20" })
        expect(occurrences.orphanEnded).toHaveBeenCalledWith({ manager: inner, ruleId: "r1", endedAt: "2026-09-20" })
    })

    it("refuses a stranger and orphans nothing", async () => {
        const { handler, occurrences } = build(jest.fn().mockResolvedValue({ kind: "refused", code: RecurErrorCode.RuleForbidden }))
        const result = await handler.execute(
            new EndRecurrenceCommand({ request: { ruleId: "r1", endedAt: "2026-09-20" }, principal: { id: "stranger", roles: ["member"] } }),
        )
        expect(result).toMatchObject({ kind: "refused", code: RecurErrorCode.RuleForbidden })
        expect(occurrences.orphanEnded).not.toHaveBeenCalled()
    })

    it("refuses an unknown rule and orphans nothing", async () => {
        const { handler, occurrences } = build(jest.fn().mockResolvedValue({ kind: "refused", code: RecurErrorCode.RuleNotFound }))
        const result = await handler.execute(new EndRecurrenceCommand({ request: { ruleId: "nope", endedAt: "2026-09-20" }, principal }))
        expect(result).toMatchObject({ kind: "refused", code: RecurErrorCode.RuleNotFound })
        expect(occurrences.orphanEnded).not.toHaveBeenCalled()
    })
})
