import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { RecurError } from "@modules/domain/recur"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { EndRecurrenceCommand } from "../../application/end-recurrence.command"
import { EndRecurrenceInput } from "./dto/end-recurrence.input"
import { EndRecurrenceType } from "./dto/end-recurrence.type"
import { toEndRecurrenceRequest, toEndRecurrenceType } from "./end-recurrence.mapper"

@Resolver()
/** GraphQL door of endRecurrence. */
export class EndRecurrenceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Ends a recurrence rule owned by the caller. */
    @Mutation(() => EndRecurrenceType, {
        name: "endRecurrence",
        description: "End a recurrence rule owned by the caller: no occurrence is generated after the given date.",
    })
    async endRecurrence(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: EndRecurrenceInput,
    ): Promise<EndRecurrenceType> {
        const outcome = await this.commandBus.execute(
            new EndRecurrenceCommand({ request: toEndRecurrenceRequest(input), principal }),
        )
        return toEndRecurrenceType(unwrapOutcome(outcome, RecurError))
    }
}
