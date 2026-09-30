import { mock } from "@starci/jest-preset/mock"
import { RecurErrorCode, RuleFrequency } from "@modules/domain/recur"
import type { RuleService, RuleView } from "@modules/domain/recur"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { MakeRecurringCommand } from "./make-recurring.command"
import type { MakeRecurringRequest } from "./make-recurring.contracts"
import { MakeRecurringHandler } from "./make-recurring.handler"

const principal: Principal = { id: "o1", roles: ["member"] }
const request: MakeRecurringRequest = {
    title: "Stand-up",
    frequency: RuleFrequency.EveryWeekday,
    n: null,
    dayOfMonth: null,
    timeZone: "Asia/Ho_Chi_Minh",
    time: "09:00",
    startDate: "2026-09-14",
}
const created: RuleView = { id: "r1", owner: "o1", endedAt: null, ...request }

const build = (create: jest.Mock): { handler: MakeRecurringHandler; rules: RuleService; inner: ReturnType<typeof mockEntityManager> } => {
    const inner = mockEntityManager()
    const rules = mock<RuleService>({ create })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new MakeRecurringHandler(mock<Logger>(), entityManager, rules), rules, inner }
}

describe("MakeRecurringHandler", () => {
    it("creates exactly one rule owned by the caller in one transaction", async () => {
        const { handler, rules, inner } = build(jest.fn().mockResolvedValue({ kind: "ok", value: created }))
        const result = await handler.execute(new MakeRecurringCommand({ request, principal }))
        expect(result).toEqual({
            kind: "ok",
            value: {
                ruleId: "r1",
                title: "Stand-up",
                frequency: RuleFrequency.EveryWeekday,
                timeZone: "Asia/Ho_Chi_Minh",
                time: "09:00",
                startDate: "2026-09-14",
            },
        })
        expect(rules.create).toHaveBeenCalledTimes(1)
        expect(rules.create).toHaveBeenCalledWith({ manager: inner, ownerId: "o1", ...request })
    })

    it("accepts a monthly-day rule naming the 31st", async () => {
        const monthly: MakeRecurringRequest = { ...request, frequency: RuleFrequency.MonthlyDay, dayOfMonth: 31 }
        const { handler, rules, inner } = build(
            jest.fn().mockResolvedValue({ kind: "ok", value: { ...created, frequency: RuleFrequency.MonthlyDay, dayOfMonth: 31 } }),
        )
        const result = await handler.execute(new MakeRecurringCommand({ request: monthly, principal }))
        expect(result).toMatchObject({ kind: "ok", value: { frequency: RuleFrequency.MonthlyDay } })
        expect(rules.create).toHaveBeenCalledWith({ manager: inner, ownerId: "o1", ...monthly })
    })

    it("returns the refusal of a shape that does not fit the frequency", async () => {
        const refusal = { kind: "refused", code: RecurErrorCode.RuleInvalid, params: { reason: "n-required" } }
        const { handler } = build(jest.fn().mockResolvedValue(refusal))
        const result = await handler.execute(
            new MakeRecurringCommand({ request: { ...request, frequency: RuleFrequency.EveryNDays }, principal }),
        )
        expect(result).toEqual(refusal)
    })
})
