import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { RecurError } from "@modules/domain/recur"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { EditRecurrenceCommand } from "../../application/edit-recurrence.command"
import { EditRecurrenceInput } from "./dto/edit-recurrence.input"
import { EditRecurrenceType } from "./dto/edit-recurrence.type"
import { toEditRecurrenceRequest, toEditRecurrenceType } from "./edit-recurrence.mapper"

@Resolver()
/** GraphQL door of editRecurrence. */
export class EditRecurrenceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Edits a recurrence rule owned by the caller. */
    @Mutation(() => EditRecurrenceType, { name: "editRecurrence" })
    async editRecurrence(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: EditRecurrenceInput,
    ): Promise<EditRecurrenceType> {
        const outcome = await this.commandBus.execute(
            new EditRecurrenceCommand({ request: toEditRecurrenceRequest(input), principal }),
        )
        return toEditRecurrenceType(unwrapOutcome(outcome, RecurError))
    }
}
