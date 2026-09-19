import {
    Context, Query, Resolver 
} from "@nestjs/graphql"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    ListTasksQuery 
} from "@modules/bussiness/task/list-tasks.query"
import type {
    ListTasksQueryResult 
} from "@modules/bussiness/task/list-tasks.query"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    TaskSummaryResponse 
} from "./graphql-types/response"

/** br.task.list.owned's GraphQL query. Dispatches onto the QueryBus, matching nivo's own split of
 * writes (CommandBus) and reads (QueryBus) once a scenario is expressed as CQRS. */
@Resolver()
/** The fr.task.list door: the caller's own tasks - ownership only, sharing never widens this list. */
export class ListTasksResolver {
    constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
    ) {}

  @Query(() => [TaskSummaryResponse],
      {
          name: "tasks", description: "List the tasks owned by the caller." 
      })
    async tasks(@Context("req") req: GraphqlRequestLike): Promise<Array<TaskSummaryResponse>> {
        const ownerId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.queryBus.execute<ListTasksQuery, ListTasksQueryResult>(
            new ListTasksQuery({
                ownerId 
            }),
        )
        return result.tasks.map(task => new TaskSummaryResponse(task.taskId,
            task.title,
            task.complete))
    }
}
