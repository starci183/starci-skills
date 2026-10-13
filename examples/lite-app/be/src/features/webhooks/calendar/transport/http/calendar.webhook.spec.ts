import { createHmac } from "node:crypto"
import { FakeClock, mock } from "@starci/jest-preset"
import type { RawBodyRequest } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { CalendarInboxService } from "@modules/domain/calendar-inbox"
import { CLOCK, ClockModule } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { HttpSecurityModule } from "@modules/platform/http-security"
import { CalendarRequest } from "./dto/calendar.request"
import { CalendarWebhook } from "./calendar.webhook"

const AT = "2026-01-02T03:04:05.000Z"
const SECRET = "spec-webhook-secret"
const SIGNED_AT = String(new Date(AT).getTime())
const DELIVERY_ID = "delivery-1"

/** The delivery the notifier sends: the validated request class, as the pipe builds it. */
const deliveryOf = (): CalendarRequest => {
    const delivery = new CalendarRequest()
    delivery.id = DELIVERY_ID
    return delivery
}

const DELIVERY = deliveryOf()
const RAW_BODY = Buffer.from(JSON.stringify(DELIVERY))
const REQUEST = mock<RawBodyRequest<Request>>({ rawBody: RAW_BODY })

const sign = (rawBody: Buffer, timestamp: string): string =>
    `sha256=${createHmac("sha256", SECRET).update(`${timestamp}.`).update(rawBody).digest("hex")}`

const build = async (deliveries: CalendarInboxService) => {
    const moduleRef = await Test.createTestingModule({
        imports: [
            ClockModule.register({ isGlobal: true }),
            HttpSecurityModule.register({
                allowedOrigins: [],
                rateLimit: { windowMs: 60_000, defaultLimit: 100, strictLimit: 100 },
                webhooks: { calendar: { secret: new Secret(SECRET), toleranceMs: 300_000 } },
            }),
        ],
        controllers: [CalendarWebhook],
        providers: [{ provide: CalendarInboxService, useValue: deliveries }],
    })
        .overrideProvider(CLOCK)
        .useValue(new FakeClock(AT))
        .compile()
    return moduleRef.get(CalendarWebhook)
}

describe("CalendarWebhook", () => {
    describe("receive", () => {
        it("proves the delivery on its raw body and headers, then hands it and its delivery id to the inbox once", async () => {
            const deliveries = mock<CalendarInboxService>()
            const door = await build(deliveries)

            await door.receive(REQUEST, sign(RAW_BODY, SIGNED_AT), SIGNED_AT, DELIVERY_ID, DELIVERY)

            expect(deliveries.acceptCalendarDelivery).toHaveBeenCalledTimes(1)
            expect(deliveries.acceptCalendarDelivery).toHaveBeenCalledWith(DELIVERY_ID, DELIVERY)
        })

        it("never reaches the inbox when the signature is not the provider's", async () => {
            const deliveries = mock<CalendarInboxService>()
            const door = await build(deliveries)

            await expect(
                door.receive(REQUEST, sign(Buffer.from("other body"), SIGNED_AT), SIGNED_AT, DELIVERY_ID, DELIVERY),
            ).rejects.toMatchObject({ code: "HTTP_SECURITY_WEBHOOK_SIGNATURE_INVALID" })

            expect(deliveries.acceptCalendarDelivery).not.toHaveBeenCalled()
        })
    })
})
