import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { NotifyError } from "@modules/domain/notify"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { UnsubscribeCommand } from "../../application/unsubscribe.command"
import { UnsubscribeInput } from "./dto/unsubscribe.input"
import { UnsubscribeType } from "./dto/unsubscribe.type"
import { toUnsubscribeRequest, toUnsubscribeType } from "./unsubscribe.mapper"

@Resolver()
/** GraphQL door of unsubscribe. */
export class UnsubscribeResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Marks the caller's channel unsubscribed, so later events are suppressed before any digest window or send. */
    @Mutation(() => UnsubscribeType, {
        name: "unsubscribe",
        description: "Stop receiving notifications on one channel.",
    })
    async unsubscribe(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: UnsubscribeInput,
    ): Promise<UnsubscribeType> {
        const outcome = await this.commandBus.execute(
            new UnsubscribeCommand({ request: toUnsubscribeRequest(input), principal }),
        )
        return toUnsubscribeType(unwrapOutcome(outcome, NotifyError))
    }
}
