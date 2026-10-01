import { Injectable } from "@nestjs/common"
import { SubscriptionService } from "@modules/domain/plan"
import { TaskService } from "@modules/domain/task"
import type { PlanUsage, PlanUsageParams } from "./taskflow.contracts"

@Injectable()
/**
 * The effective plan of a person and the active tasks the person holds: the same two reads the create scenario makes
 * for the cap guard, so the count shown matches what the guard would compute for the same person at that moment.
 */
export class PlanUsageService {
    constructor(
        private readonly subscriptions: SubscriptionService,
        private readonly tasks: TaskService,
    ) {}

    /** The plan of the person, its cap and how many active tasks the person holds. */
    async read(params: PlanUsageParams): Promise<PlanUsage> {
        const plan = await this.subscriptions.readEffectivePlan({ personId: params.personId })
        const owned = await this.tasks.listOwnedBy({ ownerId: params.personId })
        return { plan: plan.id, cap: plan.taskCap, activeCount: owned.filter((task) => !task.complete).length }
    }
}
