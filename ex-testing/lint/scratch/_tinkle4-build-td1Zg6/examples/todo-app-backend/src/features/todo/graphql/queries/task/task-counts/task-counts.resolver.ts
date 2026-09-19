import {
    Context, Query, Resolver 
} from "@nestjs/graphql"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    TaskCountsQuery 
} from "@modules/bussiness/task/task-counts.query"
import type {
    TaskCountsQueryResult 
} from "@modules/bussiness/task/task-counts.query"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    TaskCountsResponse 
} from "./graphql-types/response"

/** contract.task.list-for-dashboard's provider surface, on the one door the dashboard can actually
 * reach. Takes no person argument on purpose: the counted person is the session actor
 * (contract.login.identity-for-task), so a caller cannot ask for somebody else's counts at all -
 * ownership is enforced here, at query time, not by post-filtering. */
@Resolver()
/** The fr.task.counts door: the caller's open and complete task counts. */
export class TaskCountsResolver {
    constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
    ) {}

  @Query(() => TaskCountsResponse,
      {
          name: "taskCounts",
          description: "How many of the caller's own tasks are open and complete. Never another person's.",
      })
    async taskCounts(@Context("req") req: GraphqlRequestLike): Promise<TaskCountsResponse> {
        const ownerId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.queryBus.execute<TaskCountsQuery, TaskCountsQueryResult>(
            new TaskCountsQuery({
                ownerId 
            }),
        )
        return new TaskCountsResponse(result.open,
            result.complete)
    }
}
