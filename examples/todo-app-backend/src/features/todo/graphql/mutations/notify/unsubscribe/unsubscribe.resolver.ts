import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { UnsubscribeCommand, UnsubscribeCommandResult } from '@modules/bussiness/notify';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { UnsubscribeInput } from './graphql-types/input';
import { UnsubscribeResponse } from './graphql-types/response';

@Resolver()
export class UnsubscribeResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  @Mutation(() => UnsubscribeResponse, { name: 'unsubscribe', description: 'Stop receiving notifications on one channel.' })
  async unsubscribe(
    @Context('req') req: GraphqlRequestLike,
    @Args('input') input: UnsubscribeInput,
  ): Promise<UnsubscribeResponse> {
    const actorId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.commandBus.execute<UnsubscribeCommand, UnsubscribeCommandResult>(
      new UnsubscribeCommand({ actorId, channel: input.channel }),
    );
    return new UnsubscribeResponse(result.channel, result.unsubscribed);
  }
}
