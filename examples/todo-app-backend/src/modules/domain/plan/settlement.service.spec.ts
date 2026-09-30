import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { ok, refused } from "@modules/platform/primitives"
import { PLAN_AT, PLAN_PERIOD_END, paymentIntentRow, subscriptionRow } from "@tests/fixtures/builders/plan.builder"
import { PlanErrorCode } from "./errors/plan.error"
import { PaymentService } from "./payment.service"
import { SettlementService } from "./settlement.service"
import { SubscriptionService } from "./subscription.service"

const DAY_MS = 24 * 60 * 60 * 1000

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
            payments.findByGatewayIntentId.mockResolvedValue(paymentIntentRow())
            payments.markPaidIfNotApplied.mockResolvedValue(ok({ intent: paymentIntentRow({ status: "paid", appliedAt: PLAN_AT }), alreadyApplied: false }))
            subscriptions.findById.mockResolvedValue(subscriptionRow({ status: "pending" }))
            subscriptions.confirm.mockResolvedValue(subscriptionRow({ plan: "paid", status: "active", periodEnd: PLAN_PERIOD_END }))

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: PLAN_PERIOD_END, at: PLAN_AT }),
            ).resolves.toSucceedWith({ applied: true, subscriptionStatus: "active" })

            expect(payments.findByGatewayIntentId).toHaveBeenCalledWith({ manager, gatewayIntentId: "g1" })
            expect(payments.markPaidIfNotApplied).toHaveBeenCalledWith({ manager, id: "i1", at: PLAN_AT })
            expect(subscriptions.findById).toHaveBeenCalledWith({ manager, id: "s1" })
            expect(subscriptions.confirm).toHaveBeenCalledWith({ manager, subscription: subscriptionRow({ status: "pending" }), periodEnd: PLAN_PERIOD_END })
        })

        it("defaults the paid period to 30 days from the settlement instant", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(paymentIntentRow())
            payments.markPaidIfNotApplied.mockResolvedValue(ok({ intent: paymentIntentRow({ status: "paid", appliedAt: PLAN_AT }), alreadyApplied: false }))
            subscriptions.findById.mockResolvedValue(subscriptionRow({ status: "pending" }))
            subscriptions.confirm.mockResolvedValue(subscriptionRow({ plan: "paid", status: "active" }))

            await service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: undefined, at: PLAN_AT })

            expect(subscriptions.confirm).toHaveBeenCalledWith({
                manager,
                subscription: subscriptionRow({ status: "pending" }),
                periodEnd: new Date(PLAN_AT.getTime() + 30 * DAY_MS),
            })
        })

        it("confirms nothing for a replay and reports the status as it stands", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(paymentIntentRow())
            payments.markPaidIfNotApplied.mockResolvedValue(ok({ intent: paymentIntentRow({ status: "paid", appliedAt: PLAN_AT }), alreadyApplied: true }))
            subscriptions.findById.mockResolvedValue(subscriptionRow({ plan: "paid", status: "active" }))

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: undefined, at: PLAN_AT }),
            ).resolves.toSucceedWith({ applied: false, subscriptionStatus: "active" })

            expect(subscriptions.confirm).not.toHaveBeenCalled()
        })

        it("refuses an unknown gateway intent rather than ignoring it", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(null)

            await expect(
                service.apply({ manager, gatewayIntentId: "nope", outcome: "paid", periodEnd: undefined, at: PLAN_AT }),
            ).resolves.toBeRefused(PlanErrorCode.PaymentIntentNotFound)

            expect(payments.markPaidIfNotApplied).not.toHaveBeenCalled()
            expect(subscriptions.confirm).not.toHaveBeenCalled()
        })

        it("passes on the refusal of the ledger", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(paymentIntentRow())
            payments.markPaidIfNotApplied.mockResolvedValue(refused(PlanErrorCode.PaymentIntentNotFound))

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: undefined, at: PLAN_AT }),
            ).resolves.toBeRefused(PlanErrorCode.PaymentIntentNotFound)

            expect(subscriptions.findById).not.toHaveBeenCalled()
        })

        it("refuses an intent whose subscription is gone", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(paymentIntentRow())
            payments.markPaidIfNotApplied.mockResolvedValue(ok({ intent: paymentIntentRow({ status: "paid", appliedAt: PLAN_AT }), alreadyApplied: false }))
            subscriptions.findById.mockResolvedValue(null)

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "paid", periodEnd: undefined, at: PLAN_AT }),
            ).resolves.toBeRefused(PlanErrorCode.SubscriptionNotFound)

            expect(subscriptions.confirm).not.toHaveBeenCalled()
        })
    })

    describe("apply a failed outcome", () => {
        it("returns a pending subscription to free", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(paymentIntentRow())
            payments.markFailed.mockResolvedValue(ok(paymentIntentRow({ status: "failed" })))
            subscriptions.findById.mockResolvedValue(subscriptionRow({ status: "pending" }))
            subscriptions.abandon.mockResolvedValue(subscriptionRow())

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "failed", periodEnd: undefined, at: PLAN_AT }),
            ).resolves.toSucceedWith({ applied: false, subscriptionStatus: "free" })

            expect(payments.markFailed).toHaveBeenCalledWith({ manager, id: "i1", at: PLAN_AT })
            expect(subscriptions.abandon).toHaveBeenCalledWith({ manager, subscription: subscriptionRow({ status: "pending" }) })
            expect(payments.markPaidIfNotApplied).not.toHaveBeenCalled()
        })

        it("never unwinds an activation when the failure arrives after the payment was applied", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(paymentIntentRow())
            payments.markFailed.mockResolvedValue(ok(paymentIntentRow({ status: "paid", appliedAt: PLAN_AT })))
            subscriptions.findById.mockResolvedValue(subscriptionRow({ plan: "paid", status: "active" }))

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "failed", periodEnd: undefined, at: PLAN_AT }),
            ).resolves.toSucceedWith({ applied: false, subscriptionStatus: "active" })

            expect(subscriptions.abandon).not.toHaveBeenCalled()
        })

        it("passes on the refusal of the ledger", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(paymentIntentRow())
            payments.markFailed.mockResolvedValue(refused(PlanErrorCode.PaymentIntentNotFound))

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "failed", periodEnd: undefined, at: PLAN_AT }),
            ).resolves.toBeRefused(PlanErrorCode.PaymentIntentNotFound)

            expect(subscriptions.findById).not.toHaveBeenCalled()
        })

        it("refuses an intent whose subscription is gone", async () => {
            const { service, payments, subscriptions, manager } = await build()
            payments.findByGatewayIntentId.mockResolvedValue(paymentIntentRow())
            payments.markFailed.mockResolvedValue(ok(paymentIntentRow({ status: "failed" })))
            subscriptions.findById.mockResolvedValue(null)

            await expect(
                service.apply({ manager, gatewayIntentId: "g1", outcome: "failed", periodEnd: undefined, at: PLAN_AT }),
            ).resolves.toBeRefused(PlanErrorCode.SubscriptionNotFound)

            expect(subscriptions.abandon).not.toHaveBeenCalled()
        })
    })
})
