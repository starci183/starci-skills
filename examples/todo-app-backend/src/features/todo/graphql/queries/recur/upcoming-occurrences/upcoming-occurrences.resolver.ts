import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { QueryBus } from '@nestjs/cqrs';
import { UpcomingOccurrencesQuery, UpcomingOccurrencesQueryResult } from '@modules/bussiness/recur';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { MaterialisedOccurrenceResponse, UpcomingOccurrencesResponse } from './graphql-types/response';

/** fr.recur.see-upcoming's GraphQL query. Dispatches onto the QueryBus, matching task's own list-tasks
 * query and this codebase's own split of writes (CommandBus) and reads (QueryBus). */
@Resolver()
export class UpcomingOccurrencesResolver {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
  ) {}

  @Query(() => UpcomingOccurrencesResponse, {
    name: 'upcomingOccurrences',
    description: 'fr.recur.see-upcoming: materialised occurrences plus a live preview of the rule\'s next dates.',
  })
  async upcomingOccurrences(
    @Context('req') req: GraphqlRequestLike,
    @Args('ruleId', { type: () => String }) ruleId: string,
  ): Promise<UpcomingOccurrencesResponse> {
    const actorId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.queryBus.execute<UpcomingOccurrencesQuery, UpcomingOccurrencesQueryResult>(
      new UpcomingOccurrencesQuery({ ruleId, actorId }),
    );
    return new UpcomingOccurrencesResponse(
      result.ruleId,
      result.materialised.map(
        occurrence => new MaterialisedOccurrenceResponse(occurrence.occurrenceId, occurrence.localDate, occurrence.dueAtUtc, occurrence.status),
      ),
      result.previewDates,
    );
  }
}
