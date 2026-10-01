import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { TaskError } from "@modules/domain/task"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { CompleteTaskCommand } from "../../application/complete-task.command"
import { toCompleteTaskRequest, toCompleteTaskType } from "./complete-task.mapper"
import { CompleteTaskInput } from "./dto/complete-task.input"
import { CompleteTaskType } from "./dto/complete-task.type"

@Resolver()
/** GraphQL door of completeTask. */
export class CompleteTaskResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Marks a task complete; the owner and editor collaborators may. */
    @Mutation(() => CompleteTaskType, { name: "completeTask" })
    async completeTask(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: CompleteTaskInput,
    ): Promise<CompleteTaskType> {
        const outcome = await this.commandBus.execute(
            new CompleteTaskCommand({ request: toCompleteTaskRequest(input), principal }),
        )
        return toCompleteTaskType(unwrapOutcome(outcome, TaskError))
    }
}
