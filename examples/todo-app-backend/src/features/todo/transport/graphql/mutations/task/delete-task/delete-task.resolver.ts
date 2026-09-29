import {
    Args, Context, Mutation, Resolver
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    DeleteTaskCommand,
} from "@modules/domain/task/index"
import type {
    DeleteTaskCommandResult,
} from "@modules/domain/task/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../application/session-actor.adapter"
import {
    DeleteTaskResponse 
} from "./graphql-types/response"
import {
    DeleteTaskRequest
} from "./graphql-types/request"

@Resolver()
/** The fr.task.delete door: removes the caller's task row. */
export class DeleteTaskResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => DeleteTaskResponse,
      {
          name: "deleteTask", description: "Delete a task permanently." 
      })
    async deleteTask(
    @Context("req") req: GraphqlRequestLike,
    @Args("request") request: DeleteTaskRequest,
    ): Promise<DeleteTaskResponse> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<DeleteTaskCommand, DeleteTaskCommandResult>(
            new DeleteTaskCommand({
                actorId, taskId: request.id
            }),
        )
        return new DeleteTaskResponse(result.deleted)
    }
}
