import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { TaskError } from "@modules/domain/task"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { ReopenTaskCommand } from "../../application/reopen-task.command"
import { ReopenTaskInput } from "./dto/reopen-task.input"
import { ReopenTaskType } from "./dto/reopen-task.type"
import { toReopenTaskRequest, toReopenTaskType } from "./reopen-task.mapper"

@Resolver()
/** GraphQL door of reopenTask. */
export class ReopenTaskResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Reopens a completed task; the owner and editor collaborators may. */
    @Mutation(() => ReopenTaskType, { name: "reopenTask" })
    async reopenTask(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: ReopenTaskInput,
    ): Promise<ReopenTaskType> {
        const outcome = await this.commandBus.execute(
            new ReopenTaskCommand({ request: toReopenTaskRequest(input), principal }),
        )
        return toReopenTaskType(unwrapOutcome(outcome, TaskError))
    }
}
