import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { RecurError } from "@modules/domain/recur"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { SkipOccurrenceCommand } from "../../application/skip-occurrence.command"
import { SkipOccurrenceInput } from "./dto/skip-occurrence.input"
import { SkipOccurrenceType } from "./dto/skip-occurrence.type"
import { toSkipOccurrenceRequest, toSkipOccurrenceType } from "./skip-occurrence.mapper"

@Resolver()
/** GraphQL door of skipOccurrence. */
export class SkipOccurrenceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Skips an occurrence of a rule of the caller without completing its task. */
    @Mutation(() => SkipOccurrenceType, {
        name: "skipOccurrence",
        description: "Skip an occurrence of a recurrence rule owned by the caller, without completing its task.",
    })
    async skipOccurrence(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: SkipOccurrenceInput,
    ): Promise<SkipOccurrenceType> {
        const outcome = await this.commandBus.execute(
            new SkipOccurrenceCommand({ request: toSkipOccurrenceRequest(input), principal }),
        )
        return toSkipOccurrenceType(unwrapOutcome(outcome, RecurError))
    }
}
