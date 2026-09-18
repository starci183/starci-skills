import { Context, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { DowngradePlanCommand, DowngradePlanCommandResult } from '@modules/bussiness/plan';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { DowngradePlanResponse } from './graphql-types/response';

@Resolver()
export class DowngradePlanResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  @Mutation(() => DowngradePlanResponse, { name: 'downgradePlan', description: 'Downgrade to the free plan, effective immediately (fr.plan.downgrade).' })
  async downgradePlan(@Context('req') req: GraphqlRequestLike): Promise<DowngradePlanResponse> {
    const ownerId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.commandBus.execute<DowngradePlanCommand, DowngradePlanCommandResult>(
      new DowngradePlanCommand({ ownerId }),
    );
    return new DowngradePlanResponse(result.subscriptionId, result.plan, result.status);
  }
}
