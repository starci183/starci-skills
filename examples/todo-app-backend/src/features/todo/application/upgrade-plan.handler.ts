import { CommandHandler } from "@nestjs/cqrs"
import { InjectPlanOptions, PaymentService, SubscriptionService } from "@modules/domain/plan"
import type { PlanOptions } from "@modules/domain/plan"
import { SepayClient } from "@modules/integrations/sepay"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { EntityManager } from "typeorm"
import { UpgradePlanCommand } from "./upgrade-plan.command"
import type { UpgradePlanResult } from "./upgrade-plan.contracts"

@CommandHandler(UpgradePlanCommand)
/**
 * Opens the checkout of the paid plan: the gateway is asked first, outside any transaction, and only when it returned an
 * intent are the subscription made pending and the payment intent recorded, in one transaction. So a gateway failure never
 * leaves a pending subscription without an intent behind it. The webhook that later confirms the payment is a separate path.
 */
export class UpgradePlanHandler extends ICQRSHandler<UpgradePlanCommand, UpgradePlanResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectPlanOptions() private readonly options: PlanOptions,
        private readonly subscriptions: SubscriptionService,
        private readonly payments: PaymentService,
        private readonly sepay: SepayClient,
    ) {
        super(logger)
    }

    protected override async process(command: UpgradePlanCommand): Promise<UpgradePlanResult> {
        const personId = command.params.principal.id
        const existing = await this.entityManager.transaction((manager) => this.subscriptions.getOrCreate({ manager, personId }))
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
}
