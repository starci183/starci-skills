import { RuleFrequency } from "@modules/domain/recur"
import { toMakeRecurringRequest, toMakeRecurringType } from "./make-recurring.mapper"

describe("make-recurring mapper", () => {
    it("maps the input to the request, turning an absent n and dayOfMonth into null", () => {
        const input = {
            title: "Stand-up",
            frequency: RuleFrequency.EveryWeekday,
            timeZone: "Asia/Ho_Chi_Minh",
            time: "09:00",
            startDate: "2026-09-14",
        }
        expect(toMakeRecurringRequest(input)).toEqual({ ...input, n: null, dayOfMonth: null })
    })

    it("keeps the n and the dayOfMonth the caller gave", () => {
        const request = toMakeRecurringRequest({
            title: "Rent",
            frequency: RuleFrequency.MonthlyDay,
            dayOfMonth: 31,
            timeZone: "Europe/Berlin",
            time: "08:30",
            startDate: "2026-01-01",
        })
        expect(request).toMatchObject({ n: null, dayOfMonth: 31 })
    })

    it("maps the created rule to the type", () => {
        const made = {
            ruleId: "r1",
            title: "Stand-up",
            frequency: RuleFrequency.EveryWeekday,
            timeZone: "Asia/Ho_Chi_Minh",
            time: "09:00",
            startDate: "2026-09-14",
        }
        expect(toMakeRecurringType(made)).toEqual(made)
    })
})
