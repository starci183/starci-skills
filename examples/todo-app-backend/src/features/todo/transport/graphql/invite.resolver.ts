import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { ShareError } from "@modules/domain/share"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { InviteCommand } from "../../application/invite.command"
import { InviteInput } from "./dto/invite.input"
import { InviteType } from "./dto/invite.type"
import { toInviteRequest, toInviteType } from "./invite.mapper"

@Resolver()
/** GraphQL door of invite. */
export class InviteResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Invites a collaborator onto a task the caller owns. */
    @Mutation(() => InviteType, {
        name: "invite",
        description: "Invite a collaborator onto one of the caller's own tasks.",
    })
    async invite(@CurrentPrincipal() principal: Principal, @Args("request") input: InviteInput): Promise<InviteType> {
        const outcome = await this.commandBus.execute(new InviteCommand({ request: toInviteRequest(input), principal }))
        return toInviteType(unwrapOutcome(outcome, ShareError))
    }
}
