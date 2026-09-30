import { mock } from "@starci/jest-preset/mock"
import { CapGuardPolicy } from "./cap-guard.policy"
import { FREE_PLAN, FREE_PLAN_TASK_CAP, PAID_PLAN } from "./plan.policy"
import type { SubscriptionService } from "./subscription.service"

const guardOn = (plan: typeof FREE_PLAN): { policy: CapGuardPolicy; subscriptions: SubscriptionService } => {
    const subscriptions = mock<SubscriptionService>({ readEffectivePlan: jest.fn().mockResolvedValue(plan) })
    return { policy: new CapGuardPolicy(subscriptions), subscriptions }
}

describe("CapGuardPolicy", () => {
    it("allows a free person under the cap", async () => {
        const { policy, subscriptions } = guardOn(FREE_PLAN)
        await expect(policy.check({ personId: "p1", activeTaskCount: FREE_PLAN_TASK_CAP - 1 })).resolves.toEqual({ allowed: true })
        expect(subscriptions.readEffectivePlan).toHaveBeenCalledWith({ personId: "p1" })
    })

    it("refuses a free person at the cap, naming the cap and the upgrade path", async () => {
        const { policy } = guardOn(FREE_PLAN)
        await expect(policy.check({ personId: "p1", activeTaskCount: FREE_PLAN_TASK_CAP })).resolves.toEqual({
            allowed: false,
            cap: 20,
            upgradePath: "/plan/usage",
        })
    })

    it("refuses a downgraded person who is over the cap the same way", async () => {
        const { policy } = guardOn(FREE_PLAN)
        await expect(policy.check({ personId: "p1", activeTaskCount: 35 })).resolves.toMatchObject({ allowed: false, cap: 20 })
    })

    it("never refuses a paid person, however many active tasks they hold", async () => {
        const { policy } = guardOn(PAID_PLAN)
        await expect(policy.check({ personId: "p1", activeTaskCount: 10_000 })).resolves.toEqual({ allowed: true })
    })
})
