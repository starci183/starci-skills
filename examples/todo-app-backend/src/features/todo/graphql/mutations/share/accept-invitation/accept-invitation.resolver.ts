import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { AcceptInvitationCommand, AcceptInvitationCommandResult } from '@modules/bussiness/share';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { AcceptInvitationInput } from './graphql-types/input';
import { AcceptInvitationResponse } from './graphql-types/response';

@Resolver()
export class AcceptInvitationResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  @Mutation(() => AcceptInvitationResponse, { name: 'acceptInvitation', description: 'Accept a pending invitation addressed to the caller.' })
  async acceptInvitation(
    @Context('req') req: GraphqlRequestLike,
    @Args('input') input: AcceptInvitationInput,
  ): Promise<AcceptInvitationResponse> {
    const actorId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.commandBus.execute<AcceptInvitationCommand, AcceptInvitationCommandResult>(
      new AcceptInvitationCommand({ actorId, invitationId: input.invitationId, email: input.email }),
    );
    return new AcceptInvitationResponse(result.invitationId, result.role, result.status);
  }
}
