import { Context, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { UpgradePlanCommand, UpgradePlanCommandResult } from '@modules/bussiness/plan';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { UpgradePlanResponse } from './graphql-types/response';

@Resolver()
export class UpgradePlanResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  @Mutation(() => UpgradePlanResponse, { name: 'upgradePlan', description: 'Start checkout for the paid plan (fr.plan.upgrade).' })
  async upgradePlan(@Context('req') req: GraphqlRequestLike): Promise<UpgradePlanResponse> {
    const ownerId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.commandBus.execute<UpgradePlanCommand, UpgradePlanCommandResult>(
      new UpgradePlanCommand({ ownerId }),
    );
    return new UpgradePlanResponse(result.subscriptionId, result.paymentIntentId, result.checkoutUrl, result.status);
  }
}
