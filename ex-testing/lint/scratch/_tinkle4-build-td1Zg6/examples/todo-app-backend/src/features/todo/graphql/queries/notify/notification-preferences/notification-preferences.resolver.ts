import {
    Args, Context, Query, Resolver 
} from "@nestjs/graphql"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    NotificationPreferencesQuery 
} from "@modules/bussiness/notify/notification-preferences.query"
import type {
    NotificationPreferencesQueryResult 
} from "@modules/bussiness/notify/notification-preferences.query"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    NotificationPreferencesResponse 
} from "./graphql-types/response"

/** data.notify.preference's GraphQL read. `channel` defaults to `email`, the only channel this feature
 * sends on today (integration.notify.smtp). */
@Resolver()
/** The fr.notify.preferences.read door: the caller's subscription state and digest window for one channel - defaults when no row was ever written. */
export class NotificationPreferencesResolver {
    constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
    ) {}

  @Query(() => NotificationPreferencesResponse,
      {
          name: "notificationPreferences", description: "The caller's own notification preferences for one channel." 
      })
    async notificationPreferences(
    @Context("req") req: GraphqlRequestLike,
    @Args("channel",
        {
            nullable: true, defaultValue: "email" 
        }) channel: string,
    ): Promise<NotificationPreferencesResponse> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.queryBus.execute<NotificationPreferencesQuery, NotificationPreferencesQueryResult>(
            new NotificationPreferencesQuery({
                actorId, channel 
            }),
        )
        return new NotificationPreferencesResponse(result.channel,
            result.unsubscribed,
            result.digestWindowMinutes)
    }
}
