import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import { CalendarsService } from "@modules/domain/calendars"
import { InjectWebhookSignature, RateLimit, RateTier } from "@modules/platform/http-security"
import type { WebhookSignatureService } from "@modules/platform/http-security"
import { CalendarRequest } from "./dto/calendar.request"

@Controller("webhooks/calendar")
/**
 * POST /webhooks/calendar, the signed intake door of the calendar notifier. The signature and the replay window are proven
 * first; the verified delivery goes to exactly one intake method of CalendarsService (`acceptCalendarDelivery`), which records it
 * once and publishes the event in its own transaction.
 */
export class CalendarWebhook {
    constructor(
        @InjectWebhookSignature() private readonly signature: WebhookSignatureService,
        private readonly deliveries: CalendarsService,
    ) {}

    /** Acknowledges with 204 and no body: the notifier learns only that the delivery was accepted. */
    @Post()
    @HttpCode(HttpStatus.NO_CONTENT)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Headers("x-calendar-signature") signature: string | undefined,
        @Headers("x-calendar-timestamp") timestamp: string | undefined,
        @Body() delivery: CalendarRequest,
    ): Promise<void> {
        this.signature.verify({ provider: "calendar", rawBody: request.rawBody, signature, timestamp })
        await this.deliveries.acceptCalendarDelivery(delivery)
    }
}
