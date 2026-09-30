import type { SubscriptionEntity } from "./entities/subscription.entity"
import { toSubscriptionView } from "./subscription.rows"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("subscription rows mapper", () => {
    it("copies a subscription row into the view", () => {
        const row: SubscriptionEntity = {
            id: "s1",
            personId: "p1",
            plan: "paid",
            status: "active",
            periodEnd: AT,
            gatewayCustomerId: "c1",
        }
        expect(toSubscriptionView(row)).toEqual(row)
    })

    it("keeps the nullable columns of a free subscription null", () => {
        const row: SubscriptionEntity = {
            id: "s2",
            personId: "p2",
            plan: "free",
            status: "free",
            periodEnd: null,
            gatewayCustomerId: null,
        }
        expect(toSubscriptionView(row)).toEqual(row)
    })
})
