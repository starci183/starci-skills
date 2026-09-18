import { Context, Query, Resolver } from '@nestjs/graphql';
import { QueryBus } from '@nestjs/cqrs';
import { ListTasksQuery, ListTasksQueryResult } from '@modules/bussiness/task';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { TaskSummaryResponse } from './graphql-types/response';

/** br.task.list.owned's GraphQL query. Dispatches onto the QueryBus, matching nivo's own split of
 * writes (CommandBus) and reads (QueryBus) once a scenario is expressed as CQRS. */
@Resolver()
export class ListTasksResolver {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
  ) {}

  @Query(() => [TaskSummaryResponse], { name: 'tasks', description: 'List the tasks owned by the caller.' })
  async tasks(@Context('req') req: GraphqlRequestLike): Promise<TaskSummaryResponse[]> {
    const ownerId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.queryBus.execute<ListTasksQuery, ListTasksQueryResult>(
      new ListTasksQuery({ ownerId }),
    );
    return result.tasks.map(task => new TaskSummaryResponse(task.taskId, task.title, task.complete));
  }
}
