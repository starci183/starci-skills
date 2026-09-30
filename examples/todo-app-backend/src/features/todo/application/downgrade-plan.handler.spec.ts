import { mock } from "@starci/jest-preset/mock"
import type { SubscriptionService, SubscriptionView } from "@modules/domain/plan"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { DowngradePlanCommand } from "./downgrade-plan.command"
import { DowngradePlanHandler } from "./downgrade-plan.handler"

const principal: Principal = { id: "p1", roles: ["member"] }
const active: SubscriptionView = {
    id: "s1",
    personId: "p1",
    plan: "paid",
    status: "active",
    periodEnd: new Date("2026-10-30T00:00:00.000Z"),
    gatewayCustomerId: null,
}
const free: SubscriptionView = { ...active, plan: "free", status: "free", periodEnd: null }

describe("DowngradePlanHandler", () => {
    it("downgrades the subscription of the caller to free in one transaction", async () => {
        const inner = mockEntityManager()
        const subscriptions = mock<SubscriptionService>({
            getOrCreate: jest.fn().mockResolvedValue(active),
            downgrade: jest.fn().mockResolvedValue(free),
        })
        const handler = new DowngradePlanHandler(mock<Logger>(), mockEntityManager({ transaction: fakeTransaction(inner) }), subscriptions)
        const result = await handler.execute(new DowngradePlanCommand({ request: {}, principal }))
        expect(result).toEqual({ subscriptionId: "s1", plan: "free", status: "free" })
        expect(subscriptions.getOrCreate).toHaveBeenCalledWith({ manager: inner, personId: "p1" })
        expect(subscriptions.downgrade).toHaveBeenCalledWith({ manager: inner, subscription: active })
    })

    it("never refuses: a caller who is already free gets the free subscription back", async () => {
        const subscriptions = mock<SubscriptionService>({
            getOrCreate: jest.fn().mockResolvedValue(free),
            downgrade: jest.fn().mockResolvedValue(free),
        })
        const handler = new DowngradePlanHandler(mock<Logger>(), mockEntityManager({ transaction: fakeTransaction(mockEntityManager()) }), subscriptions)
        await expect(handler.execute(new DowngradePlanCommand({ request: {}, principal }))).resolves.toEqual({
            subscriptionId: "s1",
            plan: "free",
            status: "free",
        })
    })
})
