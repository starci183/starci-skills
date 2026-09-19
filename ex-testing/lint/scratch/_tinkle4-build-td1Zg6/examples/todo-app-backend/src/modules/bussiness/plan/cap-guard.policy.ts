import {
    Injectable 
} from "@nestjs/common"
import {
    TaskCreationPolicy 
} from "../task/creation-policy.contracts"
import {
    TaskService 
} from "../task/task.service"
import {
    PlanCapExceededException 
} from "@modules/shared/exceptions/errors/plan/plan-cap-exceeded"

import {
    SubscriptionService 
} from "./subscription.service"

/** Structurally identical to task's own CreateTaskPrincipalParams/CreateTaskInputParams
 * (creation-policy.contracts.ts), not imported from there: that file exports nothing outside
 * `bussiness/task`'s own index.ts today, and this feature does not edit that module to add one - the
 * seam (TaskCreationPolicy, an abstract class) is the only contract this lane may depend on. TypeScript
 * checks the override structurally, so a locally declared, shape-identical parameter type satisfies it. */
interface CapGuardPrincipal {
  readonly actorId: string;
}

const UPGRADE_PATH = "/plan/usage"

/**
 * sds.plan.cap-guard: given a person's effective plan (read through SubscriptionService's
 * t-revert-on-read, never the raw stored status) and their active task count (br.plan.active-scope), a
 * create is refused before anything is written once the free cap is reached. Registered into
 * `TaskCreationPolicyRegistry` by `PlanModule.onModuleInit` (contract.plan.create-precondition,
 * closing gap.plan.cap-guard-not-wired) - task's own create path already consults every registered
 * policy before writing, so this class alone is what makes that consultation refuse anything.
 */
@Injectable()
/** Policy seam for the plan cap guard decision; assertMay* refuses by throwing a house exception, never by returning a verdict flag. */
export class PlanCapGuardPolicy extends TaskCreationPolicy {
    constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly taskService: TaskService,
    ) {
        super()
    }

    async assertMayCreate(principal: CapGuardPrincipal): Promise<void> {
        const plan = await this.subscriptionService.readEffectivePlan(principal.actorId)
        if (plan.taskCap === undefined) {
            // t-under-cap for a paid (uncapped) person: nothing to check, the create proceeds.
            return
        }
        // br.plan.active-scope: a completed task never counts toward the cap.
        const owned = await this.taskService.listOwnedBy(principal.actorId)
        const activeCount = owned.filter(task => !task.complete).length
        if (activeCount >= plan.taskCap) {
            // t-at-cap: refused, naming the cap and the upgrade path. Nothing is written.
            throw new PlanCapExceededException({
                cap: plan.taskCap, upgradePath: UPGRADE_PATH 
            })
        }
    // t-under-cap: the create proceeds.
    }
}
