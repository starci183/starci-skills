import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { InviteCommand, InviteCommandResult } from '@modules/bussiness/share';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { InviteInput } from './graphql-types/input';
import { InviteResponse } from './graphql-types/response';

/** fr.share.invite's GraphQL mutation. The caller is trusted as the task's owner exactly as the record's
 * own actor label describes ("owner"); see the final report's note on gap.share.task-ownership-read-seam
 * for why this resolver cannot independently verify taskId actually belongs to ownerId. */
@Resolver()
export class InviteResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  @Mutation(() => InviteResponse, { name: 'invite', description: 'Invite a collaborator onto one of the caller’s own tasks.' })
  async invite(
    @Context('req') req: GraphqlRequestLike,
    @Args('input') input: InviteInput,
  ): Promise<InviteResponse> {
    const ownerId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.commandBus.execute<InviteCommand, InviteCommandResult>(
      new InviteCommand({ ownerId, taskId: input.taskId, email: input.email, role: input.role }),
    );
    return new InviteResponse(result.invitationId, result.taskId, result.email, result.role, result.status);
  }
}
