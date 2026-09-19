import {
    Context, Query, Resolver 
} from "@nestjs/graphql"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    PlanUsageQuery 
} from "@modules/bussiness/plan/plan-usage.query"
import type {
    PlanUsageQueryResult 
} from "@modules/bussiness/plan/plan-usage.query"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    PlanUsageResponse 
} from "./graphql-types/response"

/** fr.plan.usage.view's GraphQL query. Dispatches onto the QueryBus, matching nivo's own split of writes
 * (CommandBus) and reads (QueryBus). */
@Resolver()
/** The fr.plan.usage door: the caller's effective plan, its active-task cap (null while paid) and the current active count. */
export class PlanUsageResolver {
    constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
    ) {}

  @Query(() => PlanUsageResponse,
      {
          name: "planUsage", description: "The caller's usage against the free cap." 
      })
    async planUsage(@Context("req") req: GraphqlRequestLike): Promise<PlanUsageResponse> {
        const ownerId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.queryBus.execute<PlanUsageQuery, PlanUsageQueryResult>(new PlanUsageQuery({
            ownerId 
        }))
        return new PlanUsageResponse(result.plan,
            result.cap,
            result.activeCount)
    }
}
