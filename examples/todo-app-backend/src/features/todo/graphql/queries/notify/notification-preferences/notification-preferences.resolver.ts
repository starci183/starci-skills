import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { QueryBus } from '@nestjs/cqrs';
import { NotificationPreferencesQuery, NotificationPreferencesQueryResult } from '@modules/bussiness/notify';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { NotificationPreferencesResponse } from './graphql-types/response';

/** data.notify.preference's GraphQL read. `channel` defaults to `email`, the only channel this feature
 * sends on today (integration.notify.smtp). */
@Resolver()
export class NotificationPreferencesResolver {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
  ) {}

  @Query(() => NotificationPreferencesResponse, { name: 'notificationPreferences', description: "The caller's own notification preferences for one channel." })
  async notificationPreferences(
    @Context('req') req: GraphqlRequestLike,
    @Args('channel', { nullable: true, defaultValue: 'email' }) channel: string,
  ): Promise<NotificationPreferencesResponse> {
    const actorId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.queryBus.execute<NotificationPreferencesQuery, NotificationPreferencesQueryResult>(
      new NotificationPreferencesQuery({ actorId, channel }),
    );
    return new NotificationPreferencesResponse(result.channel, result.unsubscribed, result.digestWindowMinutes);
  }
}
