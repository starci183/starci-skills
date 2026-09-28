import {
    Args, Context, Mutation, Resolver
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    ReopenTaskCommand,
} from "@modules/domain/task/index"
import type {
    ReopenTaskCommandResult,
} from "@modules/domain/task/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../session-actor.adapter"
import {
    ReopenTaskResponse 
} from "./graphql-types/response"
import {
    ReopenTaskRequest
} from "./graphql-types/request"

@Resolver()
/** The fr.task.reopen door: flips a completed task back to open and clears its completed timestamp. */
export class ReopenTaskResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => ReopenTaskResponse,
      {
          name: "reopenTask", description: "Reopen a completed task." 
      })
    async reopenTask(
    @Context("req") req: GraphqlRequestLike,
    @Args("request") request: ReopenTaskRequest,
    ): Promise<ReopenTaskResponse> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<ReopenTaskCommand, ReopenTaskCommandResult>(
            new ReopenTaskCommand({
                actorId, taskId: request.id
            }),
        )
        return new ReopenTaskResponse(result.taskId,
            result.complete)
    }
}
