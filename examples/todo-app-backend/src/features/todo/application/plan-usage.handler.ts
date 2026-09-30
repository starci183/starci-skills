import { QueryHandler } from "@nestjs/cqrs"
import { SubscriptionService } from "@modules/domain/plan"
import { TaskService } from "@modules/domain/task"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { PlanUsageResult } from "./plan-usage.contracts"
import { PlanUsageQuery } from "./plan-usage.query"

@QueryHandler(PlanUsageQuery)
/**
 * The effective plan of the caller and the active tasks the caller holds: the same two reads the create-task handler makes
 * for the cap guard, so the count shown matches what the guard would compute for the same person at that moment.
 */
export class PlanUsageHandler extends ICQRSHandler<PlanUsageQuery, PlanUsageResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly subscriptions: SubscriptionService,
        private readonly tasks: TaskService,
    ) {
        super(logger)
    }

    protected override async process(query: PlanUsageQuery): Promise<PlanUsageResult> {
        const personId = query.params.principal.id
        const plan = await this.subscriptions.readEffectivePlan({ personId })
        const owned = await this.tasks.listOwnedBy({ ownerId: personId })
        return { plan: plan.id, cap: plan.taskCap, activeCount: owned.filter((task) => !task.complete).length }
    }
}
