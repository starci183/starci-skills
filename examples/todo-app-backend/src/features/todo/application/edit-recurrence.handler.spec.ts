import { mock } from "@starci/jest-preset/mock"
import { RecurErrorCode, RuleFrequency } from "@modules/domain/recur"
import type { RuleService, RuleView } from "@modules/domain/recur"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { EditRecurrenceCommand } from "./edit-recurrence.command"
import { EditRecurrenceHandler } from "./edit-recurrence.handler"

const principal: Principal = { id: "o1", roles: ["member"] }
const edited: RuleView = {
    id: "r1",
    owner: "o1",
    title: "Stand-up",
    frequency: RuleFrequency.EveryNDays,
    n: 2,
    dayOfMonth: null,
    timeZone: "Europe/Berlin",
    time: "10:30",
    startDate: "2026-09-14",
    endedAt: null,
}

/** What `build` wires: the handler and the doubles the specs assert on. */
interface Built {
    handler: EditRecurrenceHandler
    rules: RuleService
    inner: ReturnType<typeof mockEntityManager>
}

const build = (edit: jest.Mock): Built => {
    const inner = mockEntityManager()
    const rules = mock<RuleService>({ edit })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new EditRecurrenceHandler(mock<Logger>(), entityManager, rules), rules, inner }
}

describe("EditRecurrenceHandler", () => {
    it("changes the schedule for the owner and returns the new shape", async () => {
        const { handler, rules, inner } = build(jest.fn().mockResolvedValue({ kind: "ok", value: edited }))
        const result = await handler.execute(
            new EditRecurrenceCommand({
                request: { ruleId: "r1", frequency: RuleFrequency.EveryNDays, n: 2, timeZone: "Europe/Berlin", time: "10:30" },
                principal,
            }),
        )
        expect(result).toEqual({
            kind: "ok",
            value: { ruleId: "r1", frequency: RuleFrequency.EveryNDays, timeZone: "Europe/Berlin", time: "10:30" },
        })
        expect(rules.edit).toHaveBeenCalledWith({
            manager: inner,
            id: "r1",
            actorId: "o1",
            patch: { frequency: RuleFrequency.EveryNDays, n: 2, dayOfMonth: undefined, timeZone: "Europe/Berlin", time: "10:30" },
        })
    })

    it("holds the ownership check in the actor it passes: the caller, never the request", async () => {
        const { handler, rules } = build(jest.fn().mockResolvedValue({ kind: "refused", code: RecurErrorCode.RuleForbidden }))
        const result = await handler.execute(
            new EditRecurrenceCommand({ request: { ruleId: "r1", time: "10:30" }, principal: { id: "stranger", roles: ["member"] } }),
        )
        expect(result).toMatchObject({ kind: "refused", code: RecurErrorCode.RuleForbidden })
        expect(rules.edit).toHaveBeenCalledWith(expect.objectContaining({ actorId: "stranger" }))
    })

    it("returns the refusal of a shape that would be invalid", async () => {
        const refusal = { kind: "refused", code: RecurErrorCode.RuleInvalid, params: { reason: "n-required" } }
        const { handler } = build(jest.fn().mockResolvedValue(refusal))
        const result = await handler.execute(
            new EditRecurrenceCommand({ request: { ruleId: "r1", frequency: RuleFrequency.EveryNDays }, principal }),
        )
        expect(result).toEqual(refusal)
    })
})
