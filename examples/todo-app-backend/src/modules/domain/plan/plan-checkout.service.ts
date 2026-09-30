import { Injectable } from "@nestjs/common"
import { InjectSepay } from "@modules/integrations/sepay"
import type { SepayClient } from "@modules/integrations/sepay"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { PlanErrorCode } from "./errors/plan.error"
import { PaymentService } from "./payment.service"
import { InjectPlanOptions } from "./plan.decorators"
import type {
    CheckoutView,
    DowngradeParams,
    DowngradeView,
    ReconcileParams,
    ReconcileView,
    UpgradeParams,
} from "./plan.contracts"
import type { PlanOptions } from "./plan.options"
import { SettlementService } from "./settlement.service"
import { SubscriptionService } from "./subscription.service"

@Injectable()
/**
 * The plan scenarios a person starts: opening the checkout of the paid plan, returning to the free plan, and polling the
 * gateway for a payment. The gateway is always called outside a transaction, and every write joins one transaction.
 */
export class PlanCheckoutService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectPlanOptions() private readonly options: PlanOptions,
        @InjectSepay() private readonly sepay: SepayClient,
        private readonly subscriptions: SubscriptionService,
        private readonly payments: PaymentService,
        private readonly settlement: SettlementService,
    ) {}

    /**
     * Opens the checkout of the paid plan: the gateway is asked first, outside any transaction, and only when it returned an
     * intent are the subscription made pending and the payment intent recorded, in one transaction. So a gateway failure never
     * leaves a pending subscription without an intent behind it.
     */
    async upgrade(params: UpgradeParams): Promise<CheckoutView> {
        const { personId } = params
        const existing = await this.entityManager.transaction((manager) =>
            this.subscriptions.getOrCreate({ manager, personId }),
        )
        const { paidPriceMinorUnits: amount, paidCurrency: currency } = this.options
        const intent = await this.sepay.createIntent({ subscriptionId: existing.id, amount, currency })
        return this.entityManager.transaction(async (manager) => {
            const current = await this.subscriptions.getOrCreate({ manager, personId })
            const subscription = await this.subscriptions.startCheckout({ manager, subscription: current })
            const payment = await this.payments.create({
                manager,
                subscriptionId: subscription.id,
                gatewayIntentId: intent.gatewayIntentId,
                amount,
                currency,
            })
            return {
                subscriptionId: subscription.id,
                paymentIntentId: payment.id,
                checkoutUrl: intent.checkoutUrl,
                status: subscription.status,
            }
        })
    }

    /** Returns the person to the free plan at once: accept and freeze, never refused, and no task is touched. */
    downgrade(params: DowngradeParams): Promise<DowngradeView> {
        return this.entityManager.transaction(async (manager) => {
            const current = await this.subscriptions.getOrCreate({ manager, personId: params.personId })
            const subscription = await this.subscriptions.downgrade({ manager, subscription: current })
            return { subscriptionId: subscription.id, plan: subscription.plan, status: subscription.status }
        })
    }

    /**
     * Polls the gateway for the status of an intent of the person and applies exactly what a webhook would have applied,
     * through the same settlement and ledger. An intent already applied or failed is answered without a gateway call; only
     * a pending intent is polled, and the poll happens outside any transaction.
     */
    async reconcile(params: ReconcileParams): Promise<Outcome<ReconcileView, PlanErrorCode>> {
        const at = this.clock.now()
        const intent = await this.payments.findById({ id: params.paymentIntentId })
        if (!intent) return refused(PlanErrorCode.PaymentIntentNotFound)
        const subscription = await this.subscriptions.findById({ id: intent.subscriptionId })
        if (!subscription) return refused(PlanErrorCode.SubscriptionNotFound)
        if (subscription.personId !== params.personId) return refused(PlanErrorCode.Forbidden)
        if (intent.appliedAt || intent.status === "failed") {
            return ok({ gatewayStatus: intent.status, applied: false, subscriptionStatus: subscription.status })
        }
        const transaction = await this.sepay.getTransaction(intent.gatewayIntentId)
        if (transaction.status === "pending") {
            return ok({ gatewayStatus: "pending", applied: false, subscriptionStatus: subscription.status })
        }
        const reported = transaction.status
        const settled = await this.entityManager.transaction((manager) =>
            this.settlement.apply({
                manager,
                gatewayIntentId: intent.gatewayIntentId,
                outcome: reported,
                periodEnd: transaction.periodEnd,
                at,
            }),
        )
        if (settled.kind === "refused") return settled
        return ok({
            gatewayStatus: reported,
            applied: settled.value.applied,
            subscriptionStatus: settled.value.subscriptionStatus,
        })
    }
}
