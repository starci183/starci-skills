import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TaskService } from '@modules/bussiness/task';
import { SubscriptionService } from './subscription.service';
import { PlanUsageQuery, PlanUsageQueryResult } from './plan-usage.query';

/**
 * fr.plan.usage.view: the owner's effective plan is read (t-revert-on-read) and their active task count
 * is computed (br.plan.active-scope) - the same two reads PlanCapGuardPolicy makes, so "the count shown
 * always matches what the cap guard would compute for the same person at that moment" (the record's own
 * postcondition) holds by construction rather than by keeping two computations in sync by hand.
 */
@Injectable()
@QueryHandler(PlanUsageQuery)
export class PlanUsageHandler implements IQueryHandler<PlanUsageQuery, PlanUsageQueryResult> {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly taskService: TaskService,
  ) {}

  async execute(query: PlanUsageQuery): Promise<PlanUsageQueryResult> {
    const { ownerId } = query.params;
    const plan = await this.subscriptionService.readEffectivePlan(ownerId);
    const owned = await this.taskService.listOwnedBy(ownerId);
    const activeCount = owned.filter(task => !task.complete).length;
    return { plan: plan.id, cap: plan.taskCap ?? null, activeCount };
  }
}
