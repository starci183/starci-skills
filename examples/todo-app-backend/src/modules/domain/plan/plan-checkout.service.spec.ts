import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { SEPAY } from "@modules/integrations/sepay"
import type { SepayClient } from "@modules/integrations/sepay"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { PLAN_AT, PLAN_PERIOD_END, paymentIntentRow, planOptions, subscriptionRow } from "@tests/fixtures/builders/plan.builder"
import { PlanErrorCode } from "./errors/plan.error"
import { PaymentService } from "./payment.service"
import { PlanCheckoutService } from "./plan-checkout.service"
import { PLAN_OPTIONS } from "./plan.decorators"
import { SettlementService } from "./settlement.service"
import { SubscriptionService } from "./subscription.service"

const build = async () => {
    const own = mockEntityManager()
    const tx = fakeTransaction(own)
    const sepay = mock<SepayClient>()
    const subscriptions = mock<SubscriptionService>()
    const payments = mock<PaymentService>()
    const settlement = mock<SettlementService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PlanCheckoutService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: own },
            { provide: CLOCK, useValue: new FakeClock(PLAN_AT) },
            { provide: PLAN_OPTIONS, useValue: planOptions() },
            { provide: SEPAY, useValue: sepay },
            { provide: SubscriptionService, useValue: subscriptions },
            { provide: PaymentService, useValue: payments },
            { provide: SettlementService, useValue: settlement },
        ],
    }).compile()
    return { service: moduleRef.get(PlanCheckoutService), tx, sepay, subscriptions, payments, settlement }
}

describe("PlanCheckoutService", () => {
    describe("upgrade", () => {
        it("asks the gateway outside a transaction, then makes the subscription pending and records the intent in one", async () => {
            const { service, tx, sepay, subscriptions, payments } = await build()
            subscriptions.getOrCreate.mockResolvedValue(subscriptionRow())
            sepay.createIntent.mockResolvedValue({ gatewayIntentId: "g1", checkoutUrl: "https://pay.example/g1" })
            subscriptions.startCheckout.mockResolvedValue(subscriptionRow({ status: "pending" }))
            payments.create.mockResolvedValue(paymentIntentRow())

            await expect(service.upgrade({ personId: "p1" })).resolves.toEqual({
                subscriptionId: "s1",
                paymentIntentId: "i1",
                checkoutUrl: "https://pay.example/g1",
                status: "pending",
            })

            expect(sepay.createIntent).toHaveBeenCalledWith({ subscriptionId: "s1", amount: 99000, currency: "VND" })
            expect(payments.create).toHaveBeenCalledWith({
                manager: expect.anything(),
                subscriptionId: "s1",
                gatewayIntentId: "g1",
                amount: 99000,
                currency: "VND",
            })
            expect(tx.outcomes).toEqual(["commit", "commit"])
        })

        it("leaves nothing pending when the gateway fails", async () => {
            const { service, tx, sepay, subscriptions, payments } = await build()
            subscriptions.getOrCreate.mockResolvedValue(subscriptionRow())
            sepay.createIntent.mockRejectedValue(new Error("gateway down"))

            await expect(service.upgrade({ personId: "p1" })).rejects.toThrow("gateway down")

            expect(subscriptions.startCheckout).not.toHaveBeenCalled()
            expect(payments.create).not.toHaveBeenCalled()
            expect(tx.outcomes).toEqual(["commit"])
        })
    })

    describe("downgrade", () => {
        it("returns the subscription of the caller as the transition left it", async () => {
            const { service, tx, subscriptions } = await build()
            subscriptions.getOrCreate.mockResolvedValue(subscriptionRow({ plan: "paid", status: "active", periodEnd: PLAN_PERIOD_END }))
            subscriptions.downgrade.mockResolvedValue(subscriptionRow())

            await expect(service.downgrade({ personId: "p1" })).resolves.toEqual({
                subscriptionId: "s1",
                plan: "free",
                status: "free",
            })

            expect(subscriptions.getOrCreate).toHaveBeenCalledWith({ manager: expect.anything(), personId: "p1" })
            expect(tx.outcomes).toEqual(["commit"])
        })
    })

    describe("reconcile", () => {
        const request = { personId: "p1", paymentIntentId: "i1" }

        it("refuses an unknown intent", async () => {
            const { service, payments, sepay } = await build()
            payments.findById.mockResolvedValue(null)

            await expect(service.reconcile(request)).resolves.toBeRefused(PlanErrorCode.PaymentIntentNotFound)

            expect(payments.findById).toHaveBeenCalledWith({ id: "i1" })
            expect(sepay.getTransaction).not.toHaveBeenCalled()
        })

        it("refuses an intent whose subscription is gone", async () => {
            const { service, payments, subscriptions, sepay } = await build()
            payments.findById.mockResolvedValue(paymentIntentRow())
            subscriptions.findById.mockResolvedValue(null)

            await expect(service.reconcile(request)).resolves.toBeRefused(PlanErrorCode.SubscriptionNotFound)

            expect(sepay.getTransaction).not.toHaveBeenCalled()
        })

        it("refuses an intent that belongs to somebody else", async () => {
            const { service, payments, subscriptions, sepay } = await build()
            payments.findById.mockResolvedValue(paymentIntentRow())
            subscriptions.findById.mockResolvedValue(subscriptionRow({ personId: "other" }))

            await expect(service.reconcile(request)).resolves.toBeRefused(PlanErrorCode.Forbidden)

            expect(sepay.getTransaction).not.toHaveBeenCalled()
        })

        it("answers an applied intent without a gateway call", async () => {
            const { service, payments, subscriptions, sepay } = await build()
            payments.findById.mockResolvedValue(paymentIntentRow({ status: "paid", appliedAt: PLAN_AT }))
            subscriptions.findById.mockResolvedValue(subscriptionRow({ plan: "paid", status: "active" }))

            await expect(service.reconcile(request)).resolves.toSucceedWith({
                gatewayStatus: "paid",
                applied: false,
                subscriptionStatus: "active",
            })

            expect(sepay.getTransaction).not.toHaveBeenCalled()
        })

        it("answers a failed intent without a gateway call", async () => {
            const { service, payments, subscriptions, sepay } = await build()
            payments.findById.mockResolvedValue(paymentIntentRow({ status: "failed" }))
            subscriptions.findById.mockResolvedValue(subscriptionRow())

            await expect(service.reconcile(request)).resolves.toSucceedWith({
                gatewayStatus: "failed",
                applied: false,
                subscriptionStatus: "free",
            })

            expect(sepay.getTransaction).not.toHaveBeenCalled()
        })

        it("applies nothing while the gateway still reports pending", async () => {
            const { service, tx, payments, subscriptions, sepay, settlement } = await build()
            payments.findById.mockResolvedValue(paymentIntentRow())
            subscriptions.findById.mockResolvedValue(subscriptionRow({ status: "pending" }))
            sepay.getTransaction.mockResolvedValue({ status: "pending", periodEnd: undefined })

            await expect(service.reconcile(request)).resolves.toSucceedWith({
                gatewayStatus: "pending",
                applied: false,
                subscriptionStatus: "pending",
            })

            expect(sepay.getTransaction).toHaveBeenCalledWith("g1")
            expect(settlement.apply).not.toHaveBeenCalled()
            expect(tx.outcomes).toEqual([])
        })

        it("applies a paid report through the settlement in one transaction", async () => {
            const { service, tx, payments, subscriptions, sepay, settlement } = await build()
            payments.findById.mockResolvedValue(paymentIntentRow())
            subscriptions.findById.mockResolvedValue(subscriptionRow({ status: "pending" }))
            sepay.getTransaction.mockResolvedValue({ status: "paid", periodEnd: PLAN_PERIOD_END })
            settlement.apply.mockResolvedValue(ok({ applied: true, subscriptionStatus: "active" }))

            await expect(service.reconcile(request)).resolves.toSucceedWith({
                gatewayStatus: "paid",
                applied: true,
                subscriptionStatus: "active",
            })

            expect(settlement.apply).toHaveBeenCalledWith({
                manager: expect.anything(),
                gatewayIntentId: "g1",
                outcome: "paid",
                periodEnd: PLAN_PERIOD_END,
                at: PLAN_AT,
            })
            expect(tx.outcomes).toEqual(["commit"])
        })

        it("passes on a refusal of the settlement", async () => {
            const { service, payments, subscriptions, sepay, settlement } = await build()
            payments.findById.mockResolvedValue(paymentIntentRow())
            subscriptions.findById.mockResolvedValue(subscriptionRow({ status: "pending" }))
            sepay.getTransaction.mockResolvedValue({ status: "failed", periodEnd: undefined })
            settlement.apply.mockResolvedValue(refused(PlanErrorCode.SubscriptionNotFound))

            await expect(service.reconcile(request)).resolves.toBeRefused(PlanErrorCode.SubscriptionNotFound)
        })
    })
})
