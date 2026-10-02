import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PaymentService } from "@modules/domain/payment"
import { WebhookSignatureService } from "@modules/platform/http-security"
import { PaymentGatewayWebhook } from "./payment-gateway.webhook"
import type { PaymentNotificationRequest } from "./dto/payment-notification.request"

const NOTIFICATION: PaymentNotificationRequest = { eventId: "evt-1", orderId: "o-1", status: "confirmed", amountCents: 1500 }
const RAW_BODY = Buffer.from(JSON.stringify(NOTIFICATION))

const build = async (signature: WebhookSignatureService, payments: PaymentService) => {
    const moduleRef = await Test.createTestingModule({
        controllers: [PaymentGatewayWebhook],
        providers: [
            { provide: WebhookSignatureService, useValue: signature },
            { provide: PaymentService, useValue: payments },
        ],
    }).compile()
    return moduleRef.get(PaymentGatewayWebhook)
}

describe("PaymentGatewayWebhook", () => {
    it("proves the delivery on its raw body and hands it to the intake once", async () => {
        const signature = mock<WebhookSignatureService>()
        const payments = mock<PaymentService>()
        const door = await build(signature, payments)

        await door.receive({ rawBody: RAW_BODY } as never, "sig", "1790899200000", NOTIFICATION)

        expect(signature.verify).toHaveBeenCalledWith({ rawBody: RAW_BODY, signature: "sig", timestamp: "1790899200000" })
        expect(payments.acceptNotification).toHaveBeenCalledTimes(1)
        expect(payments.acceptNotification).toHaveBeenCalledWith(NOTIFICATION)
    })

    it("never reaches the intake when the proof throws", async () => {
        const refusal = new Error("signature")
        const signature = mock<WebhookSignatureService>({
            verify: jest.fn(() => {
                throw refusal
            }),
        })
        const payments = mock<PaymentService>()
        const door = await build(signature, payments)

        await expect(door.receive({ rawBody: RAW_BODY } as never, "bad", "1790899200000", NOTIFICATION)).rejects.toBe(refusal)

        expect(payments.acceptNotification).not.toHaveBeenCalled()
    })
})
