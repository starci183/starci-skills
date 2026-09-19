import {
    Body, Controller, Headers, HttpCode, HttpStatus, Post 
} from "@nestjs/common"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    SepayClient 
} from "@modules/integrations/sepay/sepay.client"
import {
    PlanWebhookUnauthorizedException 
} from "@modules/shared/exceptions/errors/plan/plan-webhook-unauthorized"

import {
    ConfirmPaymentCommand 
} from "@modules/bussiness/plan/confirm-payment.command"
import type {
    ConfirmPaymentCommandResult 
} from "@modules/bussiness/plan/confirm-payment.command"


interface SepayWebhookBody {
  readonly id: string;
  readonly status: "paid" | "failed";
  readonly periodEnd?: string;
}

/**
 * integration.plan.sepay's webhook endpoint (POST /webhooks/sepay). This is the one plain HTTP door this
 * feature adds beside `/health` (every owner-facing action stays on GraphQL): SePay is an external
 * system calling this product, not a browser, so there is no session token and no GraphQL client here -
 * matching HealthController's own placement under `features/todo/http/**`, not GraphQL.
 *
 * fr.plan.upgrade's exception flow: "The webhook arrives with an invalid signature; it is ignored, the
 * subscription stays pending, and no money is treated as received." A failed authorization check answers
 * 200 with `{ignored: true}` rather than propagating the exception as a 4xx/5xx - SePay's own retry
 * policy should not be given a reason to keep re-delivering a request this endpoint has already decided
 * to ignore, and nothing about an unauthenticated delivery should be observable to whoever sent it.
 */
@Controller("webhooks/sepay")
/** POST /webhooks/sepay - the gateway's signed intake door; an unauthorized delivery is ignored with a 200, never propagated (see the boundary rationale above). */
export class SepayWebhookController {
    constructor(
    private readonly sepayClient: SepayClient,
    private readonly commandBus: CommandBus,
    ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
    async handle(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: SepayWebhookBody,
    ): Promise<{ ignored: boolean } | ConfirmPaymentCommandResult> {
        try {
            this.sepayClient.assertWebhookAuthorized(authorization)
        } catch (error) {
            if (error instanceof PlanWebhookUnauthorizedException) {
                return {
                    ignored: true 
                }
            }
            throw error
        }
        return this.commandBus.execute<ConfirmPaymentCommand, ConfirmPaymentCommandResult>(
            new ConfirmPaymentCommand({
                gatewayIntentId: body.id,
                outcome: body.status,
                periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
            }),
        )
    }
}
