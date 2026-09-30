import { mock } from "@starci/jest-preset/mock"
import type { PaymentService, PlanOptions, SubscriptionService } from "@modules/domain/plan"
import type { SepayClient } from "@modules/integrations/sepay"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { sepayRequestFailure } from "@tests/fixtures/gateway-errors"
import { UpgradePlanCommand } from "./upgrade-plan.command"
import { UpgradePlanHandler } from "./upgrade-plan.handler"

type PaymentIntentView = Awaited<ReturnType<PaymentService["create"]>>
type SubscriptionView = Awaited<ReturnType<SubscriptionService["getOrCreate"]>>

const principal: Principal = { id: "p1", roles: ["member"] }
const options: PlanOptions = { paidPriceMinorUnits: 99000, paidCurrency: "VND" }
const free: SubscriptionView = { id: "s1", personId: "p1", plan: "free", status: "free", periodEnd: null, gatewayCustomerId: null }
const intent: PaymentIntentView = {
    id: "i1",
    subscriptionId: "s1",
    gateway: "sepay",
    gatewayIntentId: "g1",
    amount: 99000,
    currency: "VND",
    status: "pending",
    appliedAt: null,
}

/** What `build` wires: the handler and the doubles the specs assert on. */
interface Built {
    handler: UpgradePlanHandler
    subscriptions: SubscriptionService
    payments: PaymentService
    sepay: SepayClient
    inner: ReturnType<typeof mockEntityManager>
}

const build = (
    createIntent: jest.Mock = jest.fn().mockResolvedValue({ gatewayIntentId: "g1", checkoutUrl: "https://pay.test/g1" }),
): Built => {
    const inner = mockEntityManager()
    const subscriptions = mock<SubscriptionService>({
        getOrCreate: jest.fn().mockResolvedValue(free),
        startCheckout: jest.fn().mockResolvedValue({ ...free, status: "pending" }),
    })
    const payments = mock<PaymentService>({ create: jest.fn().mockResolvedValue(intent) })
    const sepay = mock<SepayClient>({ createIntent })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return {
        handler: new UpgradePlanHandler(mock<Logger>(), entityManager, options, subscriptions, payments, sepay),
        subscriptions,
        payments,
        sepay,
        inner,
    }
}

describe("UpgradePlanHandler", () => {
    it("asks the gateway for the catalog price, then makes the subscription pending and records the intent in one transaction", async () => {
        const { handler, subscriptions, payments, sepay, inner } = build()
        const result = await handler.execute(new UpgradePlanCommand({ request: {}, principal }))
        expect(result).toEqual({ subscriptionId: "s1", paymentIntentId: "i1", checkoutUrl: "https://pay.test/g1", status: "pending" })
        expect(sepay.createIntent).toHaveBeenCalledWith({ subscriptionId: "s1", amount: 99000, currency: "VND" })
        expect(subscriptions.startCheckout).toHaveBeenCalledWith({ manager: inner, subscription: free })
        expect(payments.create).toHaveBeenCalledWith({
            manager: inner,
            subscriptionId: "s1",
            gatewayIntentId: "g1",
            amount: 99000,
            currency: "VND",
        })
    })

    it("writes no pending subscription and no intent when the gateway fails", async () => {
        const failure = sepayRequestFailure({ operation: "create-intent", reason: "timeout" })
        const { handler, subscriptions, payments } = build(jest.fn().mockRejectedValue(failure))
        await expect(handler.execute(new UpgradePlanCommand({ request: {}, principal }))).rejects.toBe(failure)
        expect(subscriptions.startCheckout).not.toHaveBeenCalled()
        expect(payments.create).not.toHaveBeenCalled()
    })
})
