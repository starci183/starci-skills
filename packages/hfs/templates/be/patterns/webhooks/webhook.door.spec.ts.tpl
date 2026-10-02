import { createHmac } from "node:crypto"
import { FakeClock, mock } from "@starci/jest-preset"
import type { RawBodyRequest } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { @@service@@ } from "@@serviceModule@@"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { HttpSecurityModule } from "@modules/platform/http-security"
import { @@Event@@Request } from "./dto/@@event@@.request"
import { @@Provider@@Webhook } from "./@@provider@@.webhook"

const AT = "2026-01-02T03:04:05.000Z"
const SECRET = "spec-webhook-secret"
const SIGNED_AT = String(new Date(AT).getTime())

/** The delivery the notifier sends: the validated request class, as the pipe builds it. */
const deliveryOf = (): @@Event@@Request => {
    const delivery = new @@Event@@Request()
    delivery.id = "delivery-1"
    return delivery
}

const DELIVERY = deliveryOf()
const RAW_BODY = Buffer.from(JSON.stringify(DELIVERY))
const REQUEST = mock<RawBodyRequest<Request>>({ rawBody: RAW_BODY })

const sign = (rawBody: Buffer, timestamp: string): string =>
    `sha256=${createHmac("sha256", SECRET).update(`${timestamp}.`).update(rawBody).digest("hex")}`

const build = async (deliveries: @@service@@) => {
    const moduleRef = await Test.createTestingModule({
        imports: [
            HttpSecurityModule.register({
                allowedOrigins: [],
                rateLimit: { windowMs: 60_000, defaultLimit: 100, strictLimit: 100 },
                webhooks: { "@@provider@@": { secret: new Secret(SECRET), toleranceMs: 300_000 } },
            }),
        ],
        controllers: [@@Provider@@Webhook],
        providers: [
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: @@service@@, useValue: deliveries },
        ],
    }).compile()
    return moduleRef.get(@@Provider@@Webhook)
}

describe("@@Provider@@Webhook", () => {
    describe("receive", () => {
        it("proves the delivery on its raw body and headers, then hands it to the intake once", async () => {
            const deliveries = mock<@@service@@>()
            const door = await build(deliveries)

            await door.receive(REQUEST, sign(RAW_BODY, SIGNED_AT), SIGNED_AT, DELIVERY)

            expect(deliveries.accept@@Provider@@Delivery).toHaveBeenCalledTimes(1)
            expect(deliveries.accept@@Provider@@Delivery).toHaveBeenCalledWith(DELIVERY)
        })

        it("never reaches the intake when the signature is not the provider's", async () => {
            const deliveries = mock<@@service@@>()
            const door = await build(deliveries)

            await expect(
                door.receive(REQUEST, sign(Buffer.from("other body"), SIGNED_AT), SIGNED_AT, DELIVERY),
            ).rejects.toMatchObject({ code: "HTTP_SECURITY_WEBHOOK_SIGNATURE_INVALID" })

            expect(deliveries.accept@@Provider@@Delivery).not.toHaveBeenCalled()
        })
    })
})
