import {
    Args, Context, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    InviteCommand,
} from "@modules/domain/share/index"
import type {
    InviteCommandResult,
} from "@modules/domain/share/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../application/session-actor.adapter"
import {
    InviteInput 
} from "./graphql-types/input"
import {
    InviteResponse 
} from "./graphql-types/response"
import {
    TODO_MESSAGES 
} from "../../../../../messages/index"

/** fr.share.invite's GraphQL mutation. The caller is trusted as the task's owner exactly as the record's
 * own actor label describes ("owner"); see the final report's note on gap.share.task-ownership-read-seam
 * for why this resolver cannot independently verify taskId actually belongs to ownerId. */
@Resolver()
/** The fr.share.invite door: the owner creates a pending invitation on one of their tasks, addressed to an email with a role. */
export class InviteResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => InviteResponse,
      {
          name: "invite", description: TODO_MESSAGES.get("invite.description") 
      })
    async invite(
    @Context("req") req: GraphqlRequestLike,
    @Args("request") input: InviteInput,
    ): Promise<InviteResponse> {
        const ownerId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<InviteCommand, InviteCommandResult>(
            new InviteCommand({
                ownerId, taskId: input.taskId, email: input.email, role: input.role 
            }),
        )
        return new InviteResponse(result.invitationId,
            result.taskId,
            result.email,
            result.role,
            result.status)
    }
}
