import { mock } from "@starci/jest-preset"
import type { RawBodyRequest } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { @@service@@ } from "@@serviceModule@@"
import { WebhookSignatureService } from "@modules/platform/http-security"
import { @@Event@@Request } from "./dto/@@event@@.request"
import { @@Provider@@Webhook } from "./@@provider@@.webhook"

/** The delivery the notifier sends: the validated request class, as the pipe builds it. */
const deliveryOf = (): @@Event@@Request => {
    const delivery = new @@Event@@Request()
    delivery.id = "delivery-1"
    return delivery
}

const DELIVERY = deliveryOf()
const RAW_BODY = Buffer.from(JSON.stringify(DELIVERY))
const REQUEST = mock<RawBodyRequest<Request>>({ rawBody: RAW_BODY })

const build = async (signature: WebhookSignatureService, deliveries: @@service@@) => {
    const moduleRef = await Test.createTestingModule({
        controllers: [@@Provider@@Webhook],
        providers: [
            { provide: WebhookSignatureService, useValue: signature },
            { provide: @@service@@, useValue: deliveries },
        ],
    }).compile()
    return moduleRef.get(@@Provider@@Webhook)
}

describe("@@Provider@@Webhook", () => {
    describe("receive", () => {
        it("proves the delivery on its raw body and headers, then hands it to the intake once", async () => {
            const signature = mock<WebhookSignatureService>()
            const deliveries = mock<@@service@@>()
            const door = await build(signature, deliveries)

            await door.receive(REQUEST, "sha256=abc", "1790899200000", DELIVERY)

            expect(signature.verify).toHaveBeenCalledWith({
                provider: "@@provider@@",
                rawBody: RAW_BODY,
                signature: "sha256=abc",
                timestamp: "1790899200000",
            })
            expect(deliveries.accept@@Provider@@Delivery).toHaveBeenCalledTimes(1)
            expect(deliveries.accept@@Provider@@Delivery).toHaveBeenCalledWith(DELIVERY)
        })

        it("never reaches the intake when the proof throws", async () => {
            const refusal = new Error("the signature is not the provider's")
            const signature = mock<WebhookSignatureService>({
                verify: jest.fn(() => {
                    throw refusal
                }),
            })
            const deliveries = mock<@@service@@>()
            const door = await build(signature, deliveries)

            await expect(door.receive(REQUEST, undefined, undefined, DELIVERY)).rejects.toBe(refusal)

            expect(deliveries.accept@@Provider@@Delivery).not.toHaveBeenCalled()
        })
    })
})
