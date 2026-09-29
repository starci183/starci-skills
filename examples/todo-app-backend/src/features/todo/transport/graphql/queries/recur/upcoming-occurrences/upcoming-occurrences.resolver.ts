import {
    Args, Context, Query, Resolver 
} from "@nestjs/graphql"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    UpcomingOccurrencesQuery,
} from "@modules/domain/recur/index"
import type {
    UpcomingOccurrencesQueryResult,
} from "@modules/domain/recur/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../application/session-actor.adapter"
import {
    MaterialisedOccurrenceResponse, UpcomingOccurrencesResponse 
} from "./graphql-types/response"
import {
    UpcomingOccurrencesRequest
} from "./graphql-types/request"
import {
    TODO_MESSAGES 
} from "../../../../../messages/index"

/** fr.recur.see-upcoming's GraphQL query. Dispatches onto the QueryBus, matching task's own list-tasks
 * query and this codebase's own split of writes (CommandBus) and reads (QueryBus). */
@Resolver()
/** The fr.recur.upcoming door: a rule's materialised occurrences plus the live-computed preview dates the rule would still fire on. */
export class UpcomingOccurrencesResolver {
    constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
    ) {}

  @Query(() => UpcomingOccurrencesResponse,
      {
          name: "upcomingOccurrences",
          description: TODO_MESSAGES.get("upcomingOccurrences.description"),
      })
    async upcomingOccurrences(
    @Context("req") req: GraphqlRequestLike,
    @Args("request") request: UpcomingOccurrencesRequest,
    ): Promise<UpcomingOccurrencesResponse> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.queryBus.execute<UpcomingOccurrencesQuery, UpcomingOccurrencesQueryResult>(
            new UpcomingOccurrencesQuery({
                ruleId: request.ruleId, actorId
            }),
        )
        return new UpcomingOccurrencesResponse(
            result.ruleId,
            result.materialised.map(
                occurrence => new MaterialisedOccurrenceResponse(occurrence.occurrenceId,
                    occurrence.localDate,
                    occurrence.dueAtUtc,
                    occurrence.status),
            ),
            result.previewDates,
        )
    }
}
