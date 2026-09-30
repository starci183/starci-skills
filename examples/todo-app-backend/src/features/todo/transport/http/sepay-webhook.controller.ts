import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { PlanError } from "@modules/domain/plan"
import { Public, PublicReason } from "@modules/domain/session"
import { InjectSepayOptions, isWebhookAuthorized } from "@modules/integrations/sepay"
import type { SepayOptions } from "@modules/integrations/sepay"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { unwrapOutcome } from "@modules/platform/primitives"
import { ConfirmPaymentCommand } from "../../application/confirm-payment.command"
import { SepayWebhookRequest } from "./dto/sepay-webhook.request"
import type { SepayWebhookResponse } from "./dto/sepay-webhook.response"
import { toConfirmPaymentRequest, toIgnoredSepayWebhookResponse, toSepayWebhookResponse } from "./sepay-webhook.mapper"

/** The inbox source of the deliveries of this door. */
const WEBHOOK_SOURCE = "sepay.webhook"

@Controller("webhooks/sepay")
/**
 * POST /webhooks/sepay, the signed intake door of the payment gateway. A delivery with an invalid signature, and a
 * replayed delivery, are ignored with a 200 and `{ ignored: true }` so the gateway has no reason to keep redelivering and
 * learns nothing from an unauthenticated call. Otherwise exactly one ConfirmPaymentCommand is dispatched.
 */
export class SepayWebhookController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectSepayOptions() private readonly options: SepayOptions,
    ) {}

    /** Verifies the shared secret, claims the delivery once, and applies what the gateway reported. */
    @Post()
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Headers("authorization") authorization: string | undefined,
        @Body() body: SepayWebhookRequest,
    ): Promise<SepayWebhookResponse> {
        if (!isWebhookAuthorized(authorization, this.options.webhookSecret)) return toIgnoredSepayWebhookResponse()
        const claimed = await this.inbox.claim(WEBHOOK_SOURCE, body.id)
        if (!claimed) return toIgnoredSepayWebhookResponse()
        try {
            const outcome = await this.commandBus.execute(
                new ConfirmPaymentCommand({ request: toConfirmPaymentRequest(body) }),
            )
            return toSepayWebhookResponse(unwrapOutcome(outcome, PlanError))
        } catch (error) {
            await this.inbox.release(WEBHOOK_SOURCE, body.id)
            throw error
        }
    }
}
