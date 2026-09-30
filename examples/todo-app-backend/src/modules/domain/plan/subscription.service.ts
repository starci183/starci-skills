import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EntityManager } from "typeorm"
import { SubscriptionEntity } from "./persistence/entities/subscription.entity"
import { toSubscriptionView } from "./persistence/subscription.rows"
import type {
    ConfirmSubscriptionParams,
    FindSubscriptionParams,
    GetOrCreateSubscriptionParams,
    PlanDefinition,
    ReadPlanParams,
    SubscriptionLookupResult,
    SubscriptionView,
    TransitionSubscriptionParams,
} from "./plan.contracts"
import { FREE_PLAN, planOfStatus } from "./plan.policy"

@Injectable()
/**
 * The subscription row of each person and the only writer of its status. Method names follow the transitions of the
 * lifecycle. The effective plan is read through the status, never the raw column, so a lapsed row reads as free.
 */
export class SubscriptionService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The subscription of the person, created free on first touch: exactly one row per person. */
    async getOrCreate(params: GetOrCreateSubscriptionParams): Promise<SubscriptionView> {
        const existing = await params.manager.findOneBy(SubscriptionEntity, { personId: params.personId })
        if (existing) return toSubscriptionView(existing)
        const saved = await params.manager.save(SubscriptionEntity, {
            id: randomUUID(),
            personId: params.personId,
            plan: "free",
            status: "free",
            periodEnd: null,
            gatewayCustomerId: null,
        })
        return toSubscriptionView(saved)
    }

    /** The subscription with this id, or null. */
    async findById(params: FindSubscriptionParams): Promise<SubscriptionLookupResult> {
        const row = await (params.manager ?? this.entityManager).findOneBy(SubscriptionEntity, { id: params.id })
        return row ? toSubscriptionView(row) : null
    }

    /** The plan the person is on right now; a person without a row is on the free plan, and nothing is written. */
    async readEffectivePlan(params: ReadPlanParams): Promise<PlanDefinition> {
        const row = await this.entityManager.findOneBy(SubscriptionEntity, { personId: params.personId })
        return row ? planOfStatus(row.status) : FREE_PLAN
    }

    /** Checkout started: the subscription becomes pending. */
    startCheckout(params: TransitionSubscriptionParams): Promise<SubscriptionView> {
        return this.write(params.manager, { ...params.subscription, status: "pending" })
    }

    /** The gateway confirmed a payment (or a renewal): the subscription becomes active on the paid plan until the period end. */
    confirm(params: ConfirmSubscriptionParams): Promise<SubscriptionView> {
        return this.write(params.manager, {
            ...params.subscription,
            status: "active",
            plan: "paid",
            periodEnd: params.periodEnd,
        })
    }

    /** The checkout was abandoned or the gateway reported a failure: the subscription becomes free again. */
    abandon(params: TransitionSubscriptionParams): Promise<SubscriptionView> {
        return this.write(params.manager, { ...params.subscription, status: "free", plan: "free", periodEnd: null })
    }

    /** The period ended without a renewal: active becomes past-due. */
    markRenewalDue(params: TransitionSubscriptionParams): Promise<SubscriptionView> {
        return this.write(params.manager, { ...params.subscription, status: "past-due" })
    }

    /** The grace ended: past-due becomes lapsed, which reads as free. */
    lapse(params: TransitionSubscriptionParams): Promise<SubscriptionView> {
        return this.write(params.manager, { ...params.subscription, status: "lapsed" })
    }

    /** The owner downgrades: an active or past-due subscription becomes free at once, never refused, and no task is touched; any other state has nothing to downgrade from and is returned as it is. */
    downgrade(params: TransitionSubscriptionParams): Promise<SubscriptionView> {
        const { subscription } = params
        if (subscription.status !== "active" && subscription.status !== "past-due") return Promise.resolve(subscription)
        return this.abandon(params)
    }

    private async write(manager: EntityManager, subscription: SubscriptionView): Promise<SubscriptionView> {
        const saved = await manager.save(SubscriptionEntity, {
            id: subscription.id,
            personId: subscription.personId,
            plan: subscription.plan,
            status: subscription.status,
            periodEnd: subscription.periodEnd,
            gatewayCustomerId: subscription.gatewayCustomerId,
        })
        return toSubscriptionView(saved)
    }
}
