import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import { CalendarInboxService } from "@modules/domain/calendar-inbox"
import { InjectWebhookSignature, RateLimit, RateTier } from "@modules/platform/http-security"
import type { WebhookSignatureService } from "@modules/platform/http-security"
import { CalendarRequest } from "./dto/calendar.request"

@Controller("webhooks/calendar")
/**
 * POST /webhooks/calendar, the signed intake door of the calendar notifier. The signature and replay window are proven
 * first; the verified delivery goes to one domain intake that claims its inbox row and processes it in one transaction.
 */
export class CalendarWebhook {
    constructor(
        @InjectWebhookSignature() private readonly signature: WebhookSignatureService,
        private readonly deliveries: CalendarInboxService,
    ) {}

    /** Acknowledges with 204 and no body: a duplicate receives the same acknowledgement without being processed again. */
    @Post()
    @HttpCode(HttpStatus.NO_CONTENT)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Headers("x-calendar-signature") signature: string | undefined,
        @Headers("x-calendar-timestamp") timestamp: string | undefined,
        @Headers("x-calendar-delivery-id") deliveryId: string | undefined,
        @Body() delivery: CalendarRequest,
    ): Promise<void> {
        this.signature.verify({ provider: "calendar", rawBody: request.rawBody, signature, timestamp })
        await this.deliveries.acceptCalendarDelivery(deliveryId, delivery)
    }
}
