import { toDowngradePlanType } from "./downgrade-plan.mapper"

describe("downgrade-plan mapper", () => {
    it("maps the downgraded subscription to the type", () => {
        const result = { subscriptionId: "s1", plan: "free", status: "free" }
        expect(toDowngradePlanType(result)).toEqual(result)
    })
})
