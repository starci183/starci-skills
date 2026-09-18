import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SubscriptionService } from './subscription.service';
import { DowngradePlanCommand, DowngradePlanCommandResult } from './downgrade-plan.command';

/**
 * fr.plan.downgrade: decision.plan.downgrade.policy chose accept-and-freeze, so this handler is exactly
 * SubscriptionService.tDowngrade with nothing else in front of it - never refused for being over the new
 * cap, and it touches no task row. br.plan.downgrade.freeze itself is not enforced here: it is enforced
 * by PlanCapGuardPolicy the next time the owner tries to create, from whatever count they are actually
 * at.
 */
@Injectable()
@CommandHandler(DowngradePlanCommand)
export class DowngradePlanHandler implements ICommandHandler<DowngradePlanCommand, DowngradePlanCommandResult> {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async execute(command: DowngradePlanCommand): Promise<DowngradePlanCommandResult> {
    const subscription = await this.subscriptionService.tDowngrade(command.params.ownerId);
    return { subscriptionId: subscription.id, plan: subscription.plan, status: subscription.status };
  }
}
