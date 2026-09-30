import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { RecurError } from "@modules/domain/recur"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { CompleteOccurrenceCommand } from "../../application/complete-occurrence.command"
import { toCompleteOccurrenceRequest, toCompleteOccurrenceType } from "./complete-occurrence.mapper"
import { CompleteOccurrenceInput } from "./dto/complete-occurrence.input"
import { CompleteOccurrenceType } from "./dto/complete-occurrence.type"

@Resolver()
/** GraphQL door of completeOccurrence. */
export class CompleteOccurrenceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Completes an occurrence of a rule of the caller and the task it spawned. */
    @Mutation(() => CompleteOccurrenceType, {
        name: "completeOccurrence",
        description: "Complete an occurrence of a recurrence rule owned by the caller, and the task it spawned.",
    })
    async completeOccurrence(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: CompleteOccurrenceInput,
    ): Promise<CompleteOccurrenceType> {
        const outcome = await this.commandBus.execute(
            new CompleteOccurrenceCommand({ request: toCompleteOccurrenceRequest(input), principal }),
        )
        return toCompleteOccurrenceType(unwrapOutcome(outcome, RecurError))
    }
}
