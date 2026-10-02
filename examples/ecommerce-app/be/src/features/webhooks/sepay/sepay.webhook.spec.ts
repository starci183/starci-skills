import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PaymentService } from "@modules/domain/payment"
import { HttpSecurityError, HttpSecurityErrorCode, WebhookSignatureService } from "@modules/platform/http-security"
import type { SepayTransferRequest } from "./dto/sepay-transfer.request"
import { SepayWebhook } from "./sepay.webhook"

const NOTICE: SepayTransferRequest = {
    id: 92704,
    gateway: "Vietcombank",
    transactionDate: "2026-10-02 10:00:00",
    accountNumber: "0123456789",
    code: "ORDER-1",
    content: "Thanh toan ORDER-1",
    transferType: "in",
    transferAmount: 1500,
    accumulated: 1500,
    subAccount: null,
    referenceCode: "FT0000092704",
    description: "BankAPINotify Thanh toan ORDER-1",
}
const RAW_BODY = Buffer.from(JSON.stringify(NOTICE))
const REQUEST = { rawBody: RAW_BODY } as never

const build = async (signature: WebhookSignatureService, payments: PaymentService) => {
    const moduleRef = await Test.createTestingModule({
        controllers: [SepayWebhook],
        providers: [
            { provide: WebhookSignatureService, useValue: signature },
            { provide: PaymentService, useValue: payments },
        ],
    }).compile()
    return moduleRef.get(SepayWebhook)
}

describe("SepayWebhook", () => {
    describe("receive", () => {
        it("proves the delivery on its raw body and headers, then hands the notice to the payment intake once", async () => {
            const signature = mock<WebhookSignatureService>()
            const payments = mock<PaymentService>()
            const door = await build(signature, payments)

            await door.receive(REQUEST, "sha256=abc", "1790899200000", NOTICE)

            expect(signature.verify).toHaveBeenCalledWith({
                provider: "sepay",
                rawBody: RAW_BODY,
                signature: "sha256=abc",
                timestamp: "1790899200000",
            })
            expect(payments.acceptBankTransfer).toHaveBeenCalledTimes(1)
            expect(payments.acceptBankTransfer).toHaveBeenCalledWith(NOTICE)
        })

        it("never reaches the intake when the proof throws", async () => {
            const refusal = new HttpSecurityError({ code: HttpSecurityErrorCode.WebhookSignatureInvalid })
            const signature = mock<WebhookSignatureService>({
                verify: jest.fn(() => {
                    throw refusal
                }),
            })
            const payments = mock<PaymentService>()
            const door = await build(signature, payments)

            await expect(door.receive(REQUEST, undefined, undefined, NOTICE)).rejects.toBe(refusal)

            expect(payments.acceptBankTransfer).not.toHaveBeenCalled()
        })
    })
})
