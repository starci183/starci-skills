import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { TaskError } from "@modules/domain/task"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { DeleteTaskCommand } from "../../application/delete-task.command"
import { toDeleteTaskRequest, toDeleteTaskType } from "./delete-task.mapper"
import { DeleteTaskInput } from "./dto/delete-task.input"
import { DeleteTaskType } from "./dto/delete-task.type"

@Resolver()
/** GraphQL door of deleteTask. */
export class DeleteTaskResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Deletes a task permanently; only its owner may. */
    @Mutation(() => DeleteTaskType, { name: "deleteTask", description: "Delete a task permanently." })
    async deleteTask(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: DeleteTaskInput,
    ): Promise<DeleteTaskType> {
        const outcome = await this.commandBus.execute(
            new DeleteTaskCommand({ request: toDeleteTaskRequest(input), principal }),
        )
        return toDeleteTaskType(unwrapOutcome(outcome, TaskError))
    }
}
