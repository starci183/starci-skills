import {
    Args, Context, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    CreateTaskCommand 
} from "@modules/bussiness/task/create-task.command"
import type {
    CreateTaskCommandResult 
} from "@modules/bussiness/task/create-task.command"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    CreateTaskInput 
} from "./graphql-types/input"
import {
    CreateTaskResponse 
} from "./graphql-types/response"

@Resolver()
/** The fr.task.create door: creates a task for the caller - refused when the effective plan's active-task cap is already full. */
export class CreateTaskResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => CreateTaskResponse,
      {
          name: "createTask", description: "Create a task owned by the caller." 
      })
    async createTask(
    @Context("req") req: GraphqlRequestLike,
    @Args("input") input: CreateTaskInput,
    ): Promise<CreateTaskResponse> {
        const ownerId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<CreateTaskCommand, CreateTaskCommandResult>(
            new CreateTaskCommand({
                ownerId, title: input.title 
            }),
        )
        return new CreateTaskResponse(result.taskId,
            result.title)
    }
}
