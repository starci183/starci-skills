import { toUpgradePlanType } from "./upgrade-plan.mapper"

describe("upgrade-plan mapper", () => {
    it("maps the opened checkout to the type", () => {
        const result = { subscriptionId: "s1", paymentIntentId: "i1", checkoutUrl: "https://pay.test/g1", status: "pending" }
        expect(toUpgradePlanType(result)).toEqual(result)
    })
})
