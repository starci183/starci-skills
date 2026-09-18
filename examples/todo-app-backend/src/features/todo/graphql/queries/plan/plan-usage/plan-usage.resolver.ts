import { Context, Query, Resolver } from '@nestjs/graphql';
import { QueryBus } from '@nestjs/cqrs';
import { PlanUsageQuery, PlanUsageQueryResult } from '@modules/bussiness/plan';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { PlanUsageResponse } from './graphql-types/response';

/** fr.plan.usage.view's GraphQL query. Dispatches onto the QueryBus, matching nivo's own split of writes
 * (CommandBus) and reads (QueryBus). */
@Resolver()
export class PlanUsageResolver {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
  ) {}

  @Query(() => PlanUsageResponse, { name: 'planUsage', description: "The caller's usage against the free cap." })
  async planUsage(@Context('req') req: GraphqlRequestLike): Promise<PlanUsageResponse> {
    const ownerId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.queryBus.execute<PlanUsageQuery, PlanUsageQueryResult>(new PlanUsageQuery({ ownerId }));
    return new PlanUsageResponse(result.plan, result.cap, result.activeCount);
  }
}
