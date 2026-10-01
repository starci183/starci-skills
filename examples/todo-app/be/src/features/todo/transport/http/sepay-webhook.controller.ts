import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { PlanError } from "@modules/domain/plan"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { unwrapOutcome } from "@modules/platform/primitives"
import { ConfirmPaymentCommand } from "../../application/confirm-payment.command"
import { SepayWebhookRequest } from "./dto/sepay-webhook.request"
import type { SepayWebhookResponse } from "./dto/sepay-webhook.response"
import { toConfirmPaymentRequest, toSepayWebhookResponse } from "./sepay-webhook.mapper"

@Controller("webhooks/sepay")
/**
 * POST /webhooks/sepay, the signed intake door of the payment gateway. Exactly one ConfirmPaymentCommand is dispatched; a
 * delivery with an invalid signature, and a replayed delivery, are answered with a 200 and `{ ignored: true }`.
 */
export class SepayWebhookController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Hands the delivery, with the presented Authorization header, to the plan capability. */
    @Post()
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Headers("authorization") authorization: string | undefined,
        @Body() body: SepayWebhookRequest,
    ): Promise<SepayWebhookResponse> {
        const outcome = await this.commandBus.execute(
            new ConfirmPaymentCommand({ request: toConfirmPaymentRequest(authorization, body) }),
        )
        return toSepayWebhookResponse(unwrapOutcome(outcome, PlanError))
    }
}
