import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { PlanErrorCode } from "@modules/domain/plan"
import type { SettlementService } from "@modules/domain/plan"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { ConfirmPaymentCommand } from "./confirm-payment.command"
import { ConfirmPaymentHandler } from "./confirm-payment.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")

const build = (apply: jest.Mock): { handler: ConfirmPaymentHandler; settlement: SettlementService; inner: ReturnType<typeof mockEntityManager> } => {
    const inner = mockEntityManager()
    const settlement = mock<SettlementService>({ apply })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new ConfirmPaymentHandler(mock<Logger>(), entityManager, new FakeClock(AT), settlement), settlement, inner }
}

describe("ConfirmPaymentHandler", () => {
    it("settles the reported outcome in one transaction, stamped once, and returns what changed", async () => {
        const periodEnd = new Date("2026-10-30T00:00:00.000Z")
        const { handler, settlement, inner } = build(
            jest.fn().mockResolvedValue({ kind: "ok", value: { applied: true, subscriptionStatus: "active" } }),
        )
        const result = await handler.execute(
            new ConfirmPaymentCommand({ request: { gatewayIntentId: "g1", outcome: "paid", periodEnd } }),
        )
        expect(result).toEqual({ kind: "ok", value: { applied: true, subscriptionStatus: "active" } })
        expect(settlement.apply).toHaveBeenCalledWith({ manager: inner, gatewayIntentId: "g1", outcome: "paid", periodEnd, at: AT })
    })

    it("passes a failed outcome without a period end", async () => {
        const { handler, settlement, inner } = build(
            jest.fn().mockResolvedValue({ kind: "ok", value: { applied: false, subscriptionStatus: "free" } }),
        )
        await handler.execute(new ConfirmPaymentCommand({ request: { gatewayIntentId: "g2", outcome: "failed" } }))
        expect(settlement.apply).toHaveBeenCalledWith({
            manager: inner,
            gatewayIntentId: "g2",
            outcome: "failed",
            periodEnd: undefined,
            at: AT,
        })
    })

    it("returns the refusal of an unknown intent", async () => {
        const { handler } = build(jest.fn().mockResolvedValue({ kind: "refused", code: PlanErrorCode.PaymentIntentNotFound }))
        const result = await handler.execute(new ConfirmPaymentCommand({ request: { gatewayIntentId: "nope", outcome: "paid" } }))
        expect(result).toMatchObject({ kind: "refused", code: PlanErrorCode.PaymentIntentNotFound })
    })
})
