import { FakeClock, mock } from "@starci/jest-preset"
import type { RawBodyRequest } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { PaymentService } from "@modules/domain/payment"
import { Secret } from "@modules/platform/config"
import { HttpSecurityErrorCode, WEBHOOK_SIGNATURE, WebhookSignatureService } from "@modules/platform/http-security"
import type { HttpSecurityOptions } from "@modules/platform/http-security"
import { SepayTransferRequest } from "./dto/sepay-transfer.request"
import { SepayWebhook } from "./sepay.webhook"

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
const NOW = "2026-10-02T03:00:00.000Z"
const REPLAY_WINDOW_MS = 300_000
const TIMESTAMP = String(Date.parse(NOW))
const STALE_TIMESTAMP = String(Date.parse(NOW) - REPLAY_WINDOW_MS - 1)

/** Fixed HMAC vectors bind these timestamps to the compact NOTICE bytes and the fixture secret. */
const SIGNATURE = "sha256=0bf8aa0b90c161316f51b90d0a79b04edace56ebb3a3664b015139f59b85a5fe"
const STALE_SIGNATURE = "sha256=49740cf400df7a317a63f0cf6afe83a1ee5e0376b9731b70b995bf4d5c0b1315"

const OPTIONS: HttpSecurityOptions = {
    allowedOrigins: [],
    rateLimit: { windowMs: 60_000, defaultLimit: 600, strictLimit: 30 },
    webhooks: { sepay: { secret: new Secret("sepay-unit-fixture-secret"), toleranceMs: REPLAY_WINDOW_MS } },
}

/** Resolves the real configured verifier through the door token; only the downstream intake is doubled. */
const build = async () => {
    const payments = mock<PaymentService>()
    const verifier = new WebhookSignatureService(OPTIONS, new FakeClock(NOW))
    const moduleRef = await Test.createTestingModule({
        controllers: [SepayWebhook],
        providers: [
            { provide: WEBHOOK_SIGNATURE, useValue: verifier },
            { provide: PaymentService, useValue: payments },
        ],
    }).compile()
    return { door: moduleRef.get(SepayWebhook), payments }
}

describe("SepayWebhook", () => {
    describe("receive", () => {
        it("accepts the signed exact body and hands the validated notice to the intake once", async () => {
            const { door, payments } = await build()

            await door.receive(REQUEST, SIGNATURE, TIMESTAMP, NOTICE)

            expect(payments.acceptBankTransfer).toHaveBeenCalledTimes(1)
            expect(payments.acceptBankTransfer).toHaveBeenCalledWith(NOTICE)
        })

        it("refuses altered raw bytes before the intake, even when the parsed notice is unchanged", async () => {
            const { door, payments } = await build()
            const changed = mock<RawBodyRequest<Request>>({ rawBody: Buffer.from(JSON.stringify(NOTICE, null, 2)) })

            await expect(door.receive(changed, SIGNATURE, TIMESTAMP, NOTICE)).rejects.toMatchObject({
                code: HttpSecurityErrorCode.WebhookSignatureInvalid,
            })

            expect(payments.acceptBankTransfer).not.toHaveBeenCalled()
        })

        it("refuses absent proof headers before the intake", async () => {
            const { door, payments } = await build()

            await expect(door.receive(REQUEST, undefined, undefined, NOTICE)).rejects.toMatchObject({
                code: HttpSecurityErrorCode.WebhookSignatureInvalid,
            })

            expect(payments.acceptBankTransfer).not.toHaveBeenCalled()
        })

        it("refuses a correctly signed delivery outside the replay window before the intake", async () => {
            const { door, payments } = await build()

            await expect(door.receive(REQUEST, STALE_SIGNATURE, STALE_TIMESTAMP, NOTICE)).rejects.toMatchObject({
                code: HttpSecurityErrorCode.WebhookReplayed,
            })

            expect(payments.acceptBankTransfer).not.toHaveBeenCalled()
        })

        it("propagates an intake failure instead of acknowledging the signed delivery", async () => {
            const { door, payments } = await build()
            const failure = new Error("billing transaction failed")
            payments.acceptBankTransfer.mockRejectedValue(failure)

            await expect(door.receive(REQUEST, SIGNATURE, TIMESTAMP, NOTICE)).rejects.toBe(failure)

            expect(payments.acceptBankTransfer).toHaveBeenCalledTimes(1)
        })
    })
})
