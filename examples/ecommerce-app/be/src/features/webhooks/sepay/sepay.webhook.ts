import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import { PaymentService } from "@modules/domain/payment"
import { InjectWebhookSignature, RateLimit, RateTier } from "@modules/platform/http-security"
import type { WebhookSignatureService } from "@modules/platform/http-security"
import { SepayTransferRequest } from "./dto/sepay-transfer.request"

@Controller("webhooks/sepay")
/**
 * POST /webhooks/sepay, the signed intake door of the bank transfer notifier. The signature and the replay window are proven
 * first; the verified notice goes to exactly one domain intake method, which records it once and publishes the payment event.
 */
export class SepayWebhook {
    constructor(
        @InjectWebhookSignature() private readonly signature: WebhookSignatureService,
        private readonly payments: PaymentService,
    ) {}

    /** Acknowledges with 204 and no body: the notifier learns only that the delivery was accepted. */
    @Post()
    @HttpCode(HttpStatus.NO_CONTENT)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Headers("x-sepay-signature") signature: string | undefined,
        @Headers("x-sepay-timestamp") timestamp: string | undefined,
        @Body() notice: SepayTransferRequest,
    ): Promise<void> {
        this.signature.verify({ provider: "sepay", rawBody: request.rawBody, signature, timestamp })
        await this.payments.acceptBankTransfer(notice)
    }
}
