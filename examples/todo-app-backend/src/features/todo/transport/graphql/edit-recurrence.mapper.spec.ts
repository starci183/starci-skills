import { RuleFrequency } from "@modules/domain/recur"
import { toEditRecurrenceRequest, toEditRecurrenceType } from "./edit-recurrence.mapper"

describe("edit-recurrence mapper", () => {
    it("keeps an absent field absent and an explicit null null", () => {
        expect(toEditRecurrenceRequest({ ruleId: "r1", time: "10:30" })).toEqual({
            ruleId: "r1",
            frequency: undefined,
            n: undefined,
            dayOfMonth: undefined,
            timeZone: undefined,
            time: "10:30",
        })
        expect(toEditRecurrenceRequest({ ruleId: "r1", frequency: RuleFrequency.MonthlyDay, n: null, dayOfMonth: 15 })).toMatchObject({
            frequency: RuleFrequency.MonthlyDay,
            n: null,
            dayOfMonth: 15,
        })
    })

    it("maps the edited rule to the type", () => {
        const edited = { ruleId: "r1", frequency: RuleFrequency.EveryWeekday, timeZone: "Europe/Berlin", time: "10:30" }
        expect(toEditRecurrenceType(edited)).toEqual(edited)
    })
})
