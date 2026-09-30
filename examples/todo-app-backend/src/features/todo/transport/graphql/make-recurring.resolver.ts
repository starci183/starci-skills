import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { RecurError } from "@modules/domain/recur"
import { CurrentPrincipal } from "@modules/domain/session"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { MakeRecurringCommand } from "../../application/make-recurring.command"
import { MakeRecurringInput } from "./dto/make-recurring.input"
import { MakeRecurringType } from "./dto/make-recurring.type"
import { toMakeRecurringRequest, toMakeRecurringType } from "./make-recurring.mapper"

@Resolver()
/** GraphQL door of makeRecurring. */
export class MakeRecurringResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates a recurrence rule owned by the caller. */
    @Mutation(() => MakeRecurringType, {
        name: "makeRecurring",
        description: "Create a recurrence rule owned by the caller.",
    })
    async makeRecurring(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: MakeRecurringInput,
    ): Promise<MakeRecurringType> {
        const outcome = await this.commandBus.execute(
            new MakeRecurringCommand({ request: toMakeRecurringRequest(input), principal }),
        )
        return toMakeRecurringType(unwrapOutcome(outcome, RecurError))
    }
}
