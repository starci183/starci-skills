import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { PlanErrorCode } from "@modules/domain/plan"
import type { PaymentIntentView, PaymentService, SettlementService, SubscriptionService, SubscriptionView } from "@modules/domain/plan"
import type { SepayClient, SepayTransaction } from "@modules/integrations/sepay"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { ReconcilePaymentCommand } from "./reconcile-payment.command"
import { ReconcilePaymentHandler } from "./reconcile-payment.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "p1", roles: ["member"] }
const pendingIntent: PaymentIntentView = {
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
    readonly transaction?: SepayTransaction
    readonly settled?: unknown
}

const build = (
    parts: Parts = {},
): { handler: ReconcilePaymentHandler; sepay: SepayClient; settlement: SettlementService; inner: ReturnType<typeof mockEntityManager> } => {
    const inner = mockEntityManager()
    const payments = mock<PaymentService>({ findById: jest.fn().mockResolvedValue(parts.intent === undefined ? pendingIntent : parts.intent) })
    const subscriptions = mock<SubscriptionService>({
        findById: jest.fn().mockResolvedValue(parts.subscription === undefined ? pendingSubscription : parts.subscription),
    })
    const settlement = mock<SettlementService>({
        apply: jest.fn().mockResolvedValue(parts.settled ?? { kind: "ok", value: { applied: true, subscriptionStatus: "active" } }),
    })
    const sepay = mock<SepayClient>({
        getTransaction: jest.fn().mockResolvedValue(parts.transaction ?? { status: "pending", periodEnd: undefined }),
    })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    const handler = new ReconcilePaymentHandler(mock<Logger>(), entityManager, new FakeClock(AT), payments, subscriptions, settlement, sepay)
    return { handler, sepay, settlement, inner }
}

const reconcile = (handler: ReconcilePaymentHandler, actor: Principal = principal): ReturnType<ReconcilePaymentHandler["execute"]> =>
    handler.execute(new ReconcilePaymentCommand({ request: { paymentIntentId: "i1" }, principal: actor }))

describe("ReconcilePaymentHandler", () => {
    it("changes nothing while the gateway still shows the intent pending", async () => {
        const { handler, settlement } = build()
        await expect(reconcile(handler)).resolves.toEqual({
            kind: "ok",
            value: { gatewayStatus: "pending", applied: false, subscriptionStatus: "pending" },
        })
        expect(settlement.apply).not.toHaveBeenCalled()
    })

    it("applies the activation a webhook would have caused once the gateway shows the intent paid", async () => {
        const periodEnd = new Date("2026-10-30T00:00:00.000Z")
        const { handler, settlement, inner } = build({ transaction: { status: "paid", periodEnd } })
        await expect(reconcile(handler)).resolves.toEqual({
            kind: "ok",
            value: { gatewayStatus: "paid", applied: true, subscriptionStatus: "active" },
        })
        expect(settlement.apply).toHaveBeenCalledWith({ manager: inner, gatewayIntentId: "g1", outcome: "paid", periodEnd, at: AT })
    })

    it("returns the subscription to free when the gateway shows the intent failed", async () => {
        const { handler, settlement } = build({
            transaction: { status: "failed", periodEnd: undefined },
            settled: { kind: "ok", value: { applied: false, subscriptionStatus: "free" } },
        })
        await expect(reconcile(handler)).resolves.toEqual({
            kind: "ok",
            value: { gatewayStatus: "failed", applied: false, subscriptionStatus: "free" },
        })
        expect(settlement.apply).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed" }))
    })

    it("answers an intent that was already applied without a gateway call", async () => {
        const applied: PaymentIntentView = { ...pendingIntent, status: "paid", appliedAt: AT }
        const { handler, sepay } = build({ intent: applied, subscription: { ...pendingSubscription, status: "active" } })
        await expect(reconcile(handler)).resolves.toEqual({
            kind: "ok",
            value: { gatewayStatus: "paid", applied: false, subscriptionStatus: "active" },
        })
        expect(sepay.getTransaction).not.toHaveBeenCalled()
    })

    it("refuses a person who does not own the subscription, without a gateway call", async () => {
        const { handler, sepay, settlement } = build()
        const result = await reconcile(handler, { id: "stranger", roles: ["member"] })
        expect(result).toMatchObject({ kind: "refused", code: PlanErrorCode.Forbidden })
        expect(sepay.getTransaction).not.toHaveBeenCalled()
        expect(settlement.apply).not.toHaveBeenCalled()
    })

    it("refuses an unknown intent and an intent whose subscription is gone", async () => {
        await expect(reconcile(build({ intent: null }).handler)).resolves.toMatchObject({
            kind: "refused",
            code: PlanErrorCode.PaymentIntentNotFound,
        })
        await expect(reconcile(build({ subscription: null }).handler)).resolves.toMatchObject({
            kind: "refused",
            code: PlanErrorCode.SubscriptionNotFound,
        })
    })

    it("returns the refusal of the settlement", async () => {
        const { handler } = build({
            transaction: { status: "paid", periodEnd: undefined },
            settled: { kind: "refused", code: PlanErrorCode.PaymentIntentNotFound },
        })
        await expect(reconcile(handler)).resolves.toMatchObject({ kind: "refused", code: PlanErrorCode.PaymentIntentNotFound })
    })
})
