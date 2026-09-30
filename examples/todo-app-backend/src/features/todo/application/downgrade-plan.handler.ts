import { CommandHandler } from "@nestjs/cqrs"
import { SubscriptionService } from "@modules/domain/plan"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { EntityManager } from "typeorm"
import { DowngradePlanCommand } from "./downgrade-plan.command"
import type { DowngradePlanResult } from "./downgrade-plan.contracts"

@CommandHandler(DowngradePlanCommand)
/**
 * Returns the caller to the free plan at once: accept and freeze. It is never refused for being over the new cap and it
 * touches no task; the cap guard resumes refusing creates from the real count at the next create.
 */
export class DowngradePlanHandler extends ICQRSHandler<DowngradePlanCommand, DowngradePlanResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly subscriptions: SubscriptionService,
    ) {
        super(logger)
    }

    protected override async process(command: DowngradePlanCommand): Promise<DowngradePlanResult> {
        const personId = command.params.principal.id
        return this.entityManager.transaction(async (manager) => {
            const current = await this.subscriptions.getOrCreate({ manager, personId })
            const subscription = await this.subscriptions.downgrade({ manager, subscription: current })
            return { subscriptionId: subscription.id, plan: subscription.plan, status: subscription.status }
        })
    }
}
