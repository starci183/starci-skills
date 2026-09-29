import {
    Args, Context, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    RevokeCollaboratorCommand,
} from "@modules/domain/share/index"
import type {
    RevokeCollaboratorCommandResult,
} from "@modules/domain/share/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../application/session-actor.adapter"
import {
    RevokeCollaboratorInput 
} from "./graphql-types/input"
import {
    RevokeCollaboratorResponse 
} from "./graphql-types/response"
import {
    TODO_MESSAGES 
} from "../../../../../messages/index"

@Resolver()
/** The fr.share.revoke door: flips the invitation to revoked and evicts the collaborator cache entry in the same call - access ends immediately, not by sweep. */
export class RevokeCollaboratorResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => RevokeCollaboratorResponse,
      {
          name: "revokeCollaborator", description: TODO_MESSAGES.get("revokeCollaborator.description") 
      })
    async revokeCollaborator(
    @Context("req") req: GraphqlRequestLike,
    @Args("request") input: RevokeCollaboratorInput,
    ): Promise<RevokeCollaboratorResponse> {
        const ownerId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<RevokeCollaboratorCommand, RevokeCollaboratorCommandResult>(
            new RevokeCollaboratorCommand({
                ownerId, invitationId: input.invitationId 
            }),
        )
        return new RevokeCollaboratorResponse(result.invitationId,
            result.status)
    }
}
