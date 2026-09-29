import {
    Args, Context, Mutation, Resolver
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    CompleteTaskCommand,
} from "@modules/domain/task/index"
import type {
    CompleteTaskCommandResult,
} from "@modules/domain/task/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../application/session-actor.adapter"
import {
    CompleteTaskResponse 
} from "./graphql-types/response"
import {
    CompleteTaskRequest
} from "./graphql-types/request"

@Resolver()
/** The fr.task.complete door: marks the caller's task complete and stamps its completed timestamp. */
export class CompleteTaskResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => CompleteTaskResponse,
      {
          name: "completeTask", description: "Mark a task complete." 
      })
    async completeTask(
    @Context("req") req: GraphqlRequestLike,
    @Args("request") request: CompleteTaskRequest,
    ): Promise<CompleteTaskResponse> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<CompleteTaskCommand, CompleteTaskCommandResult>(
            new CompleteTaskCommand({
                actorId, taskId: request.id
            }),
        )
        return new CompleteTaskResponse(result.taskId,
            result.complete)
    }
}
