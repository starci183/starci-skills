import { createHmac } from "node:crypto"
import { FakeClock, mock } from "@starci/jest-preset"
import type { RawBodyRequest } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { PaymentService } from "@modules/domain/payment"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { HttpSecurityModule } from "@modules/platform/http-security"
import { SepayTransferRequest } from "./dto/sepay-transfer.request"
import { SepayWebhook } from "./sepay.webhook"

const AT = "2026-09-01T00:00:00.000Z"
const SECRET = "spec-webhook-secret"
const SIGNED_AT = String(new Date(AT).getTime())

/** The notice the notifier delivers for one transfer: the validated request class, as the pipe builds it. */
const noticeOf = (): SepayTransferRequest => {
    const request = new SepayTransferRequest()
    request.id = 92704
    request.gateway = "Vietcombank"
    request.transactionDate = "2026-10-02 10:00:00"
    request.accountNumber = "0123456789"
    request.code = "1f0c1f26-6d55-4c1b-9d36-1c2f3a5b7a11"
    request.content = "Thanh toan"
    request.transferType = "in"
    request.transferAmount = 1500
    request.accumulated = 1500
    request.subAccount = null
    request.referenceCode = "FT0000092704"
    request.description = "BankAPINotify Thanh toan"
    return request
}

const NOTICE = noticeOf()
const RAW_BODY = Buffer.from(JSON.stringify(NOTICE))
const REQUEST = mock<RawBodyRequest<Request>>({ rawBody: RAW_BODY })

const sign = (rawBody: Buffer, timestamp: string): string =>
    `sha256=${createHmac("sha256", SECRET).update(`${timestamp}.`).update(rawBody).digest("hex")}`

const build = async (payments: PaymentService) => {
    const moduleRef = await Test.createTestingModule({
        imports: [
            HttpSecurityModule.register({
                allowedOrigins: [],
                rateLimit: { windowMs: 60_000, defaultLimit: 100, strictLimit: 100 },
                webhooks: { sepay: { secret: new Secret(SECRET), toleranceMs: 300_000 } },
            }),
        ],
        controllers: [SepayWebhook],
        providers: [
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: PaymentService, useValue: payments },
        ],
    }).compile()
    return moduleRef.get(SepayWebhook)
}

describe("SepayWebhook", () => {
    describe("receive", () => {
        it("proves the delivery on its raw body and headers, then hands the notice to the payment intake once", async () => {
            const payments = mock<PaymentService>()
            const door = await build(payments)

            await door.receive(REQUEST, sign(RAW_BODY, SIGNED_AT), SIGNED_AT, NOTICE)

            expect(payments.acceptBankTransfer).toHaveBeenCalledTimes(1)
            expect(payments.acceptBankTransfer).toHaveBeenCalledWith(NOTICE)
        })

        it("never reaches the intake when the signature is not the provider's", async () => {
            const payments = mock<PaymentService>()
            const door = await build(payments)

            await expect(
                door.receive(REQUEST, sign(Buffer.from("other body"), SIGNED_AT), SIGNED_AT, NOTICE),
            ).rejects.toMatchObject({
                code: "HTTP_SECURITY_WEBHOOK_SIGNATURE_INVALID",
            })

            expect(payments.acceptBankTransfer).not.toHaveBeenCalled()
        })

        it("never reaches the intake when the delivery carries no proof at all", async () => {
            const payments = mock<PaymentService>()
            const door = await build(payments)

            await expect(door.receive(REQUEST, undefined, undefined, NOTICE)).rejects.toMatchObject({
                code: "HTTP_SECURITY_WEBHOOK_SIGNATURE_INVALID",
            })

            expect(payments.acceptBankTransfer).not.toHaveBeenCalled()
        })
    })
})
