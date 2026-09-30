import { mock } from "@starci/jest-preset/mock"
import { mockEntityManager } from "@tests/fixtures/database"
import { PlanErrorCode } from "./errors/plan.error"
import type { PaymentService } from "./payment.service"
import type { PaymentIntentView, SubscriptionView } from "./plan.contracts"
import { SettlementService } from "./settlement.service"
import type { SubscriptionService } from "./subscription.service"

const AT = new Date("2026-09-30T10:00:00.000Z")
const DAY_MS = 24 * 60 * 60 * 1000

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
const pendingSubscription: SubscriptionView = {
    id: "s1",
    personId: "p1",
    plan: "free",
    status: "pending",
    periodEnd: null,
    gatewayCustomerId: null,
}

interface Parts {
    readonly intent?: PaymentIntentView | null
    readonly subscription?: SubscriptionView | null
    readonly alreadyApplied?: boolean
    readonly failedAppliedAt?: Date | null
}

const build = (parts: Parts = {}): { service: SettlementService; payments: PaymentService; subscriptions: SubscriptionService } => {
    const found = parts.intent === undefined ? intent : parts.intent
    const payments = mock<PaymentService>({
        findByGatewayIntentId: jest.fn().mockResolvedValue(found),
        markPaidIfNotApplied: jest.fn().mockResolvedValue({
            kind: "ok",
            value: { intent: { ...intent, status: "paid", appliedAt: AT }, alreadyApplied: parts.alreadyApplied ?? false },
        }),
        markFailed: jest.fn().mockResolvedValue({
            kind: "ok",
            value: { ...intent, status: parts.failedAppliedAt ? "paid" : "failed", appliedAt: parts.failedAppliedAt ?? null },
        }),
    })
    const subscriptions = mock<SubscriptionService>({
        findById: jest.fn().mockResolvedValue(parts.subscription === undefined ? pendingSubscription : parts.subscription),
        confirm: jest.fn().mockResolvedValue({ ...pendingSubscription, status: "active", plan: "paid" }),
        abandon: jest.fn().mockResolvedValue({ ...pendingSubscription, status: "free" }),
    })
    return { service: new SettlementService(payments, subscriptions), payments, subscriptions }
}

const manager = mockEntityManager()

describe("SettlementService", () => {
    it("activates a pending subscription when the gateway reports paid", async () => {
        const { service, payments, subscriptions } = build()
        const periodEnd = new Date("2026-10-30T00:00:00.000Z")
        const outcome = await service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd, at: AT })
        expect(outcome).toEqual({ kind: "ok", value: { applied: true, subscriptionStatus: "active" } })
        expect(payments.markPaidIfNotApplied).toHaveBeenCalledWith({ manager, id: "i1", at: AT })
        expect(subscriptions.confirm).toHaveBeenCalledWith({ manager, subscription: pendingSubscription, periodEnd })
    })

    it("defaults the paid period to 30 days from the settlement instant", async () => {
        const { service, subscriptions } = build()
        await service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: undefined, at: AT })
        expect(subscriptions.confirm).toHaveBeenCalledWith(
            expect.objectContaining({ periodEnd: new Date(AT.getTime() + 30 * DAY_MS) }),
        )
    })

    it("is a no-op for a replay: nothing is confirmed and the status is reported as it stands", async () => {
        const { service, subscriptions } = build({ alreadyApplied: true, subscription: { ...pendingSubscription, status: "active" } })
        const outcome = await service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: undefined, at: AT })
        expect(outcome).toEqual({ kind: "ok", value: { applied: false, subscriptionStatus: "active" } })
        expect(subscriptions.confirm).not.toHaveBeenCalled()
    })

    it("returns a pending subscription to free when the gateway reports a failure", async () => {
        const { service, subscriptions } = build()
        const outcome = await service.apply({ manager, gatewayIntentId: "g1", outcome: "failed", periodEnd: undefined, at: AT })
        expect(outcome).toEqual({ kind: "ok", value: { applied: false, subscriptionStatus: "free" } })
        expect(subscriptions.abandon).toHaveBeenCalledWith({ manager, subscription: pendingSubscription })
    })

    it("never unwinds an activation when a failure arrives after the payment was applied", async () => {
        const active: SubscriptionView = { ...pendingSubscription, status: "active", plan: "paid" }
        const { service, subscriptions } = build({ failedAppliedAt: AT, subscription: active })
        const outcome = await service.apply({ manager, gatewayIntentId: "g1", outcome: "failed", periodEnd: undefined, at: AT })
        expect(outcome).toEqual({ kind: "ok", value: { applied: false, subscriptionStatus: "active" } })
        expect(subscriptions.abandon).not.toHaveBeenCalled()
    })

    it("refuses an unknown gateway intent rather than ignoring it", async () => {
        const { service, subscriptions } = build({ intent: null })
        const outcome = await service.apply({ manager, gatewayIntentId: "nope", outcome: "paid", periodEnd: undefined, at: AT })
        expect(outcome).toMatchObject({ kind: "refused", code: PlanErrorCode.PaymentIntentNotFound })
        expect(subscriptions.confirm).not.toHaveBeenCalled()
    })

    it("refuses an intent whose subscription is gone", async () => {
        const { service } = build({ subscription: null })
        const outcome = await service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: undefined, at: AT })
        expect(outcome).toMatchObject({ kind: "refused", code: PlanErrorCode.SubscriptionNotFound })
    })
})
