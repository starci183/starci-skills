import {
    Args, Context, ID, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    ReopenTaskCommand 
} from "@modules/bussiness/task/reopen-task.command"
import type {
    ReopenTaskCommandResult 
} from "@modules/bussiness/task/reopen-task.command"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    ReopenTaskResponse 
} from "./graphql-types/response"

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
    @Args("id",
        {
            type: () => ID 
        }) id: string,
    ): Promise<ReopenTaskResponse> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<ReopenTaskCommand, ReopenTaskCommandResult>(
            new ReopenTaskCommand({
                actorId, taskId: id 
            }),
        )
        return new ReopenTaskResponse(result.taskId,
            result.complete)
    }
}
