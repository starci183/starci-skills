import {
    Args, Context, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    AcceptInvitationCommand 
} from "@modules/bussiness/share/accept-invitation.command"
import type {
    AcceptInvitationCommandResult 
} from "@modules/bussiness/share/accept-invitation.command"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    AcceptInvitationInput 
} from "./graphql-types/input"
import {
    AcceptInvitationResponse 
} from "./graphql-types/response"

@Resolver()
/** The fr.share.accept door: the invitee names its own email, binding personId to the invitation and activating the role in the same call. */
export class AcceptInvitationResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => AcceptInvitationResponse,
      {
          name: "acceptInvitation", description: "Accept a pending invitation addressed to the caller." 
      })
    async acceptInvitation(
    @Context("req") req: GraphqlRequestLike,
    @Args("input") input: AcceptInvitationInput,
    ): Promise<AcceptInvitationResponse> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<AcceptInvitationCommand, AcceptInvitationCommandResult>(
            new AcceptInvitationCommand({
                actorId, invitationId: input.invitationId, email: input.email 
            }),
        )
        return new AcceptInvitationResponse(result.invitationId,
            result.role,
            result.status)
    }
}
