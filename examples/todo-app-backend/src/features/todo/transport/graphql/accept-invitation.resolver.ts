import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/session"
import { ShareError } from "@modules/domain/share"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { AcceptInvitationCommand } from "../../application/accept-invitation.command"
import { toAcceptInvitationRequest, toAcceptInvitationType } from "./accept-invitation.mapper"
import { AcceptInvitationInput } from "./dto/accept-invitation.input"
import { AcceptInvitationType } from "./dto/accept-invitation.type"

@Resolver()
/** GraphQL door of acceptInvitation. */
export class AcceptInvitationResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Accepts the invitation addressed to the caller; the invitee names its own email. */
    @Mutation(() => AcceptInvitationType, {
        name: "acceptInvitation",
        description: "Accept a pending invitation addressed to the caller.",
    })
    async acceptInvitation(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: AcceptInvitationInput,
    ): Promise<AcceptInvitationType> {
        const outcome = await this.commandBus.execute(
            new AcceptInvitationCommand({ request: toAcceptInvitationRequest(input), principal }),
        )
        return toAcceptInvitationType(unwrapOutcome(outcome, ShareError))
    }
}
