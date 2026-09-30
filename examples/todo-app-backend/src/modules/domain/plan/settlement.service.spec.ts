import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { ok, refused } from "@modules/platform/primitives"
import { PlanErrorCode } from "./errors/plan.error"
import { PaymentService } from "./payment.service"
import type { PaymentIntentView, SubscriptionView } from "./plan.contracts"
import { SettlementService } from "./settlement.service"
import { SubscriptionService } from "./subscription.service"

const AT = new Date("2026-09-30T10:00:00.000Z")
const PERIOD_END = new Date("2026-10-30T00:00:00.000Z")
const DAY_MS = 24 * 60 * 60 * 1000

const intent = (overrides: Partial<PaymentIntentView> = {}): PaymentIntentView => ({
    id: "i1",
    subscriptionId: "s1",
    gateway: "sepay",
    gatewayIntentId: "g1",
    amount: 99000,
    currency: "VND",
    status: "pending",
    appliedAt: null,
    ...overrides,
})

const subscription = (overrides: Partial<SubscriptionView> = {}): SubscriptionView => ({
    id: "s1",
    personId: "p1",
    plan: "free",
    status: "pending",
    periodEnd: null,
    gatewayCustomerId: null,
    ...overrides,
})

const build = async () => {
    const payments = mock<PaymentService>()
    const subscriptions = mock<SubscriptionService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SettlementService,
            { provide: PaymentService, useValue: payments },
            { provide: SubscriptionService, useValue: subscriptions },
        ],
    }).compile()
    return { service: moduleRef.get(SettlementService), payments, subscriptions, manager: mockEntityManager() }
}

describe("SettlementService", () => {
    describe("apply a paid outcome", () => {
        it("activates a pending subscription until the period the gateway named", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(intent())
            payments.markPaidIfNotApplied.mockResolvedValue(ok({ intent: intent({ status: "paid", appliedAt: AT }), alreadyApplied: false }))
            subscriptions.findById.mockResolvedValue(subscription())
            subscriptions.confirm.mockResolvedValue(subscription({ plan: "paid", status: "active", periodEnd: PERIOD_END }))

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: PERIOD_END, at: AT }),
            ).resolves.toSucceedWith({ applied: true, subscriptionStatus: "active" })

            expect(payments.findByGatewayIntentId).toHaveBeenCalledWith({ manager, gatewayIntentId: "g1" })
            expect(payments.markPaidIfNotApplied).toHaveBeenCalledWith({ manager, id: "i1", at: AT })
            expect(subscriptions.findById).toHaveBeenCalledWith({ manager, id: "s1" })
            expect(subscriptions.confirm).toHaveBeenCalledWith({ manager, subscription: subscription(), periodEnd: PERIOD_END })
        })

        it("defaults the paid period to 30 days from the settlement instant", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(intent())
            payments.markPaidIfNotApplied.mockResolvedValue(ok({ intent: intent({ status: "paid", appliedAt: AT }), alreadyApplied: false }))
            subscriptions.findById.mockResolvedValue(subscription())
            subscriptions.confirm.mockResolvedValue(subscription({ plan: "paid", status: "active" }))

            await service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: undefined, at: AT })

            expect(subscriptions.confirm).toHaveBeenCalledWith({
                manager,
                subscription: subscription(),
                periodEnd: new Date(AT.getTime() + 30 * DAY_MS),
            })
        })

        it("confirms nothing for a replay and reports the status as it stands", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(intent())
            payments.markPaidIfNotApplied.mockResolvedValue(ok({ intent: intent({ status: "paid", appliedAt: AT }), alreadyApplied: true }))
            subscriptions.findById.mockResolvedValue(subscription({ plan: "paid", status: "active" }))

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: undefined, at: AT }),
            ).resolves.toSucceedWith({ applied: false, subscriptionStatus: "active" })

            expect(subscriptions.confirm).not.toHaveBeenCalled()
        })

        it("refuses an unknown gateway intent rather than ignoring it", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(null)

            await expect(
                service.apply({ manager, gatewayIntentId: "nope", outcome: "paid", periodEnd: undefined, at: AT }),
            ).resolves.toBeRefused(PlanErrorCode.PaymentIntentNotFound)

            expect(payments.markPaidIfNotApplied).not.toHaveBeenCalled()
            expect(subscriptions.confirm).not.toHaveBeenCalled()
        })

        it("passes on the refusal of the ledger", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(intent())
            payments.markPaidIfNotApplied.mockResolvedValue(refused(PlanErrorCode.PaymentIntentNotFound))

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: undefined, at: AT }),
            ).resolves.toBeRefused(PlanErrorCode.PaymentIntentNotFound)

            expect(subscriptions.findById).not.toHaveBeenCalled()
        })

        it("refuses an intent whose subscription is gone", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(intent())
            payments.markPaidIfNotApplied.mockResolvedValue(ok({ intent: intent({ status: "paid", appliedAt: AT }), alreadyApplied: false }))
            subscriptions.findById.mockResolvedValue(null)

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: undefined, at: AT }),
            ).resolves.toBeRefused(PlanErrorCode.SubscriptionNotFound)

            expect(subscriptions.confirm).not.toHaveBeenCalled()
        })
    })

    describe("apply a failed outcome", () => {
        it("returns a pending subscription to free", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(intent())
            payments.markFailed.mockResolvedValue(ok(intent({ status: "failed" })))
            subscriptions.findById.mockResolvedValue(subscription())
            subscriptions.abandon.mockResolvedValue(subscription({ status: "free" }))

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "failed", periodEnd: undefined, at: AT }),
            ).resolves.toSucceedWith({ applied: false, subscriptionStatus: "free" })

            expect(payments.markFailed).toHaveBeenCalledWith({ manager, id: "i1", at: AT })
            expect(subscriptions.abandon).toHaveBeenCalledWith({ manager, subscription: subscription() })
            expect(payments.markPaidIfNotApplied).not.toHaveBeenCalled()
        })

        it("never unwinds an activation when the failure arrives after the payment was applied", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(intent())
            payments.markFailed.mockResolvedValue(ok(intent({ status: "paid", appliedAt: AT })))
            subscriptions.findById.mockResolvedValue(subscription({ plan: "paid", status: "active" }))

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "failed", periodEnd: undefined, at: AT }),
            ).resolves.toSucceedWith({ applied: false, subscriptionStatus: "active" })

            expect(subscriptions.abandon).not.toHaveBeenCalled()
        })

        it("passes on the refusal of the ledger", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(intent())
            payments.markFailed.mockResolvedValue(refused(PlanErrorCode.PaymentIntentNotFound))

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "failed", periodEnd: undefined, at: AT }),
            ).resolves.toBeRefused(PlanErrorCode.PaymentIntentNotFound)

            expect(subscriptions.findById).not.toHaveBeenCalled()
        })

        it("refuses an intent whose subscription is gone", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(intent())
            payments.markFailed.mockResolvedValue(ok(intent({ status: "failed" })))
            subscriptions.findById.mockResolvedValue(null)

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "failed", periodEnd: undefined, at: AT }),
            ).resolves.toBeRefused(PlanErrorCode.SubscriptionNotFound)

            expect(subscriptions.abandon).not.toHaveBeenCalled()
        })
    })
})
