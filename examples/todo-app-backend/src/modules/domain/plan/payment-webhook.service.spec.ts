import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { SEPAY_OPTIONS } from "@modules/integrations/sepay"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { ok, refused } from "@modules/platform/primitives"
import { PLAN_AT, PLAN_PERIOD_END, sepayOptions, webhookDelivery } from "@tests/fixtures/builders/plan.builder"
import { PlanErrorCode } from "./errors/plan.error"
import { PaymentWebhookService } from "./payment-webhook.service"
import { SettlementService } from "./settlement.service"

const build = async () => {
    const own = mockEntityManager()
    const tx = fakeTransaction(own)
    const inbox = mock<Inbox>()
    const settlement = mock<SettlementService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentWebhookService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: own },
            { provide: CLOCK, useValue: new FakeClock(PLAN_AT) },
            { provide: INBOX, useValue: inbox },
            { provide: SEPAY_OPTIONS, useValue: sepayOptions() },
            { provide: SettlementService, useValue: settlement },
        ],
    }).compile()
    return { service: moduleRef.get(PaymentWebhookService), tx, inbox, settlement }
}

describe("PaymentWebhookService", () => {
    describe("receive", () => {
        it("ignores a delivery without an Authorization header and claims nothing", async () => {
            const { service, inbox, settlement } = await build()

            await expect(service.receive(webhookDelivery({ authorization: undefined }))).resolves.toSucceedWith({ ignored: true })

            expect(inbox.claim).not.toHaveBeenCalled()
            expect(settlement.apply).not.toHaveBeenCalled()
        })

        it("ignores a delivery signed with a wrong secret", async () => {
            const { service, inbox, settlement } = await build()

            await expect(service.receive(webhookDelivery({ authorization: "Bearer wrong" }))).resolves.toSucceedWith({ ignored: true })

            expect(inbox.claim).not.toHaveBeenCalled()
            expect(settlement.apply).not.toHaveBeenCalled()
        })

        it("ignores a replayed delivery and applies nothing", async () => {
            const { service, tx, inbox, settlement } = await build()
            inbox.claim.mockResolvedValue(false)

            await expect(service.receive(webhookDelivery())).resolves.toSucceedWith({ ignored: true })

            expect(inbox.claim).toHaveBeenCalledWith("sepay.webhook", "g1")
            expect(settlement.apply).not.toHaveBeenCalled()
            expect(tx.outcomes).toEqual([])
        })

        it("claims the delivery once and applies what the gateway reported in one transaction", async () => {
            const { service, tx, inbox, settlement } = await build()
            inbox.claim.mockResolvedValue(true)
            settlement.apply.mockResolvedValue(ok({ applied: true, subscriptionStatus: "active" }))

            await expect(service.receive(webhookDelivery())).resolves.toSucceedWith({
                ignored: false,
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
            expect(inbox.release).not.toHaveBeenCalled()
        })

        it("gives the claim back and refuses when the intent is unknown", async () => {
            const { service, inbox, settlement } = await build()
            inbox.claim.mockResolvedValue(true)
            settlement.apply.mockResolvedValue(refused(PlanErrorCode.PaymentIntentNotFound))

            await expect(service.receive(webhookDelivery())).resolves.toBeRefused(PlanErrorCode.PaymentIntentNotFound)

            expect(inbox.release).toHaveBeenCalledWith("sepay.webhook", "g1")
        })

        it("gives the claim back and rethrows when the settlement fails", async () => {
            const { service, tx, inbox, settlement } = await build()
            inbox.claim.mockResolvedValue(true)
            settlement.apply.mockRejectedValue(new Error("db down"))

            await expect(service.receive(webhookDelivery())).rejects.toThrow("db down")

            expect(inbox.release).toHaveBeenCalledWith("sepay.webhook", "g1")
            expect(tx.outcomes).toEqual(["rollback"])
        })
    })
})
