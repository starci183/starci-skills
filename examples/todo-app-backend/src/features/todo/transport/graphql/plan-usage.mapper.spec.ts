import { toPlanUsageType } from "./plan-usage.mapper"

describe("plan-usage mapper", () => {
    it("maps a capped plan and an uncapped plan to the type", () => {
        expect(toPlanUsageType({ plan: "free", cap: 20, activeCount: 3 })).toEqual({ plan: "free", cap: 20, activeCount: 3 })
        expect(toPlanUsageType({ plan: "paid", cap: null, activeCount: 30 })).toEqual({ plan: "paid", cap: null, activeCount: 30 })
    })
})
