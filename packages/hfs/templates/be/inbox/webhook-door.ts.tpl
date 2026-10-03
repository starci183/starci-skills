import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import { @@Provider@@InboxService } from "@modules/domain/@@provider@@-inbox"
import { InjectWebhookSignature, RateLimit, RateTier } from "@modules/platform/http-security"
import type { WebhookSignatureService } from "@modules/platform/http-security"
import { @@Event@@Request } from "./dto/@@event@@.request"

@Controller("webhooks/@@provider@@")
/**
 * POST /webhooks/@@provider@@, the signed intake door of the @@provider@@ notifier. The signature and replay window are proven
 * first; the verified delivery goes to one domain intake that claims its inbox row and processes it in one transaction.
 */
export class @@Provider@@Webhook {
    constructor(
        @InjectWebhookSignature() private readonly signature: WebhookSignatureService,
        private readonly deliveries: @@Provider@@InboxService,
    ) {}

    /** Acknowledges with 204 and no body: a duplicate receives the same acknowledgement without being processed again. */
    @Post()
    @HttpCode(HttpStatus.NO_CONTENT)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Headers("x-@@provider@@-signature") signature: string | undefined,
        @Headers("x-@@provider@@-timestamp") timestamp: string | undefined,
        @Headers("x-@@provider@@-delivery-id") deliveryId: string | undefined,
        @Body() delivery: @@Event@@Request,
    ): Promise<void> {
        this.signature.verify({ provider: "@@provider@@", rawBody: request.rawBody, signature, timestamp })
        await this.deliveries.accept@@Provider@@Delivery(deliveryId, delivery)
    }
}
