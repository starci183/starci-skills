import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { TaskError } from "@modules/domain/task"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { CreateTaskCommand } from "../../application/create-task.command"
import { toCreateTaskRequest, toCreateTaskType } from "./create-task.mapper"
import { CreateTaskInput } from "./dto/create-task.input"
import { CreateTaskType } from "./dto/create-task.type"

@Resolver()
/** GraphQL door of createTask. */
export class CreateTaskResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates a task owned by the caller; refused when the plan of the caller is full. */
    @Mutation(() => CreateTaskType, { name: "createTask", description: "Create a task owned by the caller." })
    async createTask(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: CreateTaskInput,
    ): Promise<CreateTaskType> {
        const outcome = await this.commandBus.execute(
            new CreateTaskCommand({ request: toCreateTaskRequest(input), principal }),
        )
        return toCreateTaskType(unwrapOutcome(outcome, TaskError))
    }
}
