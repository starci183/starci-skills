import { Injectable } from "@nestjs/common"
import type { CapCheckParams, CapVerdict } from "./plan.contracts"
import { SubscriptionService } from "./subscription.service"

/** Where an owner at the cap goes to raise it. */
const UPGRADE_PATH = "/plan/usage"

@Injectable()
/**
 * Decides whether one more active task fits the plan of a person. The effective plan is read through the subscription
 * status, and the caller states how many active tasks the person holds, so the plan capability never reads tasks.
 */
export class CapGuardPolicy {
    constructor(private readonly subscriptions: SubscriptionService) {}

    /** Allows the task unless the plan has a cap and the person is at it; a refusal names the cap and the upgrade path. */
    async check(params: CapCheckParams): Promise<CapVerdict> {
        const plan = await this.subscriptions.readEffectivePlan({ personId: params.personId })
        if (plan.taskCap === null || params.activeTaskCount < plan.taskCap) return { allowed: true }
        return { allowed: false, cap: plan.taskCap, upgradePath: UPGRADE_PATH }
    }
}
