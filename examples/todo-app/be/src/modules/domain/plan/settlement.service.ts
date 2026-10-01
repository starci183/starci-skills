import { Injectable } from "@nestjs/common"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { PlanErrorCode } from "./errors/plan.error"
import { PaymentService } from "./payment.service"
import type { ApplyGatewayOutcomeParams, SettlementView } from "./plan.contracts"
import { SubscriptionService } from "./subscription.service"

/** The paid period when the gateway names none: 30 days. */
const DEFAULT_PERIOD_MS = 30 * 24 * 60 * 60 * 1000

@Injectable()
/**
 * Applies what the gateway reported for one payment intent through the idempotent ledger, whether the report comes from a
 * webhook or from a reconciliation poll: a replay, or a failure that arrives after a payment was applied, changes nothing.
 */
export class SettlementService {
    constructor(
        private readonly payments: PaymentService,
        private readonly subscriptions: SubscriptionService,
    ) {}

    /** Settles the outcome for the intent the gateway names, or refuses when the intent or its subscription is unknown. */
    async apply(
        params: ApplyGatewayOutcomeParams,
    ): Promise<Outcome<SettlementView, PlanErrorCode.PaymentIntentNotFound | PlanErrorCode.SubscriptionNotFound>> {
        const { manager, at } = params
        const intent = await this.payments.findByGatewayIntentId({ manager, gatewayIntentId: params.gatewayIntentId })
        if (!intent) return refused(PlanErrorCode.PaymentIntentNotFound)
        const settle = { manager, id: intent.id, at }
        if (params.outcome === "failed") {
            const failed = await this.payments.markFailed(settle)
            if (failed.kind === "refused") return failed
            const subscription = await this.subscriptions.findById({ manager, id: intent.subscriptionId })
            if (!subscription) return refused(PlanErrorCode.SubscriptionNotFound)
            if (failed.value.appliedAt) return ok({ applied: false, subscriptionStatus: subscription.status })
            const abandoned = await this.subscriptions.abandon({ manager, subscription })
            return ok({ applied: false, subscriptionStatus: abandoned.status })
        }
        const marked = await this.payments.markPaidIfNotApplied(settle)
        if (marked.kind === "refused") return marked
        const subscription = await this.subscriptions.findById({ manager, id: intent.subscriptionId })
        if (!subscription) return refused(PlanErrorCode.SubscriptionNotFound)
        if (marked.value.alreadyApplied) return ok({ applied: false, subscriptionStatus: subscription.status })
        const confirmed = await this.subscriptions.confirm({
            manager,
            subscription,
            periodEnd: params.periodEnd ?? new Date(at.getTime() + DEFAULT_PERIOD_MS),
        })
        return ok({ applied: true, subscriptionStatus: confirmed.status })
    }
}
