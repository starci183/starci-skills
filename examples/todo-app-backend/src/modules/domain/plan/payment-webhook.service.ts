import { Injectable } from "@nestjs/common"
import { InjectSepayOptions, isWebhookAuthorized } from "@modules/integrations/sepay"
import type { SepayOptions } from "@modules/integrations/sepay"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { ok } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import type { PlanErrorCode } from "./errors/plan.error"
import type { WebhookDeliveryParams, WebhookReceipt } from "./plan.contracts"
import { SettlementService } from "./settlement.service"

/** The inbox source of the deliveries of the payment webhook. */
const WEBHOOK_SOURCE = "sepay.webhook"

@Injectable()
/**
 * The intake of the signed payment webhook. A delivery with an invalid signature, and a replayed delivery, are ignored so the
 * gateway has no reason to keep redelivering and learns nothing from an unauthenticated call. Otherwise the reported
 * outcome is applied through the idempotent ledger in one transaction; a refusal or a failure gives the claim back, so a
 * redelivery of the same event is processed again.
 */
export class PaymentWebhookService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectSepayOptions() private readonly options: SepayOptions,
        private readonly settlement: SettlementService,
    ) {}

    /** Verifies the shared secret, claims the delivery once, and applies what the gateway reported. */
    async receive(params: WebhookDeliveryParams): Promise<Outcome<WebhookReceipt, PlanErrorCode>> {
        if (!isWebhookAuthorized(params.authorization, this.options.webhookSecret)) return ok({ ignored: true })
        if (!(await this.inbox.claim(WEBHOOK_SOURCE, params.gatewayIntentId))) return ok({ ignored: true })
        const at = this.clock.now()
        const settled = await this.entityManager
            .transaction((manager) =>
                this.settlement.apply({
                    manager,
                    gatewayIntentId: params.gatewayIntentId,
                    outcome: params.outcome,
                    periodEnd: params.periodEnd,
                    at,
                }),
            )
            .catch(async (error: unknown) => {
                await this.inbox.release(WEBHOOK_SOURCE, params.gatewayIntentId)
                throw error
            })
        if (settled.kind === "refused") {
            await this.inbox.release(WEBHOOK_SOURCE, params.gatewayIntentId)
            return settled
        }
        return ok({ ignored: false, applied: settled.value.applied, subscriptionStatus: settled.value.subscriptionStatus })
    }
}
