import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import {
  UpdateNotificationPreferencesCommand,
  UpdateNotificationPreferencesCommandResult,
} from '@modules/bussiness/notify';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { UpdateNotificationPreferencesInput } from './graphql-types/input';
import { UpdateNotificationPreferencesResponse } from './graphql-types/response';

@Resolver()
export class UpdateNotificationPreferencesResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  @Mutation(() => UpdateNotificationPreferencesResponse, {
    name: 'updateNotificationPreferences',
    description: 'Change the digest window and/or unsubscribed flag for one notification channel.',
  })
  async updateNotificationPreferences(
    @Context('req') req: GraphqlRequestLike,
    @Args('input') input: UpdateNotificationPreferencesInput,
  ): Promise<UpdateNotificationPreferencesResponse> {
    const actorId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.commandBus.execute<UpdateNotificationPreferencesCommand, UpdateNotificationPreferencesCommandResult>(
      new UpdateNotificationPreferencesCommand({
        actorId,
        channel: input.channel,
        unsubscribed: input.unsubscribed,
        digestWindowMinutes: input.digestWindowMinutes,
      }),
    );
    return new UpdateNotificationPreferencesResponse(result.channel, result.unsubscribed, result.digestWindowMinutes);
  }
}
