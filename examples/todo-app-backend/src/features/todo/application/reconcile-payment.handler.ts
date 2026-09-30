import { CommandHandler } from "@nestjs/cqrs"
import { PaymentService, PlanErrorCode, SettlementService, SubscriptionService } from "@modules/domain/plan"
import { SepayClient } from "@modules/integrations/sepay"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { ReconcilePaymentCommand } from "./reconcile-payment.command"
import type { ReconcilePaymentResult } from "./reconcile-payment.contracts"

@CommandHandler(ReconcilePaymentCommand)
/**
 * Polls the gateway for the status of an intent of the caller and applies exactly what a webhook would have applied,
 * through the same settlement and ledger, so a reconcile and a late webhook racing each other converge on one idempotency
 * check. An intent already applied or failed is answered without a gateway call; only a pending intent is polled, and the
 * poll happens outside any transaction.
 */
export class ReconcilePaymentHandler extends ICQRSHandler<ReconcilePaymentCommand, ReconcilePaymentResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly payments: PaymentService,
        private readonly subscriptions: SubscriptionService,
        private readonly settlement: SettlementService,
        private readonly sepay: SepayClient,
    ) {
        super(logger)
    }

    protected override async process(command: ReconcilePaymentCommand): Promise<ReconcilePaymentResult> {
        const { request, principal } = command.params
        const at = this.clock.now()
        const intent = await this.payments.findById({ id: request.paymentIntentId })
        if (!intent) return refused(PlanErrorCode.PaymentIntentNotFound)
        const subscription = await this.subscriptions.findById({ id: intent.subscriptionId })
        if (!subscription) return refused(PlanErrorCode.SubscriptionNotFound)
        if (subscription.personId !== principal.id) return refused(PlanErrorCode.Forbidden)
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
