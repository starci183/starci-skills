import { RuleFrequency } from "../recur.contracts"
import type { RuleEntity } from "./entities/rule.entity"
import { toRuleView } from "./rule.rows"

describe("rule rows mapper", () => {
    it("copies a rule row into the view", () => {
        const row: RuleEntity = {
            id: "r1",
            owner: "p1",
            title: "Stand-up",
            frequency: RuleFrequency.EveryWeekday,
            n: null,
            dayOfMonth: null,
            timeZone: "Asia/Ho_Chi_Minh",
            time: "09:00",
            startDate: "2026-09-30",
            endedAt: null,
        }
        expect(toRuleView(row)).toEqual(row)
    })
})
