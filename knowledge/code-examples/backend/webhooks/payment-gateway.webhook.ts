import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import { PaymentService } from "@modules/domain/payment"
import { InjectWebhookSignature, RateLimit, RateTier } from "@modules/platform/http-security"
import type { WebhookSignatureService } from "@modules/platform/http-security"
import { PaymentNotificationRequest } from "./dto/payment-notification.request"

@Controller("webhooks/payment-gateway")
/**
 * POST /webhooks/payment-gateway, the signed intake door of the payment gateway. The signature and the replay window are proven
 * first; the verified notification goes to exactly one domain intake method, which records it and publishes the event.
 */
export class PaymentGatewayWebhook {
    constructor(
        @InjectWebhookSignature() private readonly signature: WebhookSignatureService,
        private readonly payments: PaymentService,
    ) {}

    /** Acknowledges with 204 and no body: the provider learns only that the delivery was accepted. */
    @Post()
    @HttpCode(HttpStatus.NO_CONTENT)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Headers("x-gateway-signature") signature: string | undefined,
        @Headers("x-gateway-timestamp") timestamp: string | undefined,
        @Body() body: PaymentNotificationRequest,
    ): Promise<void> {
        this.signature.verify({ provider: "payment-gateway", rawBody: request.rawBody, signature, timestamp })
        await this.payments.acceptNotification(body)
    }
}
