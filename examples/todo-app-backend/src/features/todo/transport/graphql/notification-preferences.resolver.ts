import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/session"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { NotificationPreferencesQuery } from "../../application/notification-preferences.query"
import { NotificationPreferencesInput } from "./dto/notification-preferences.input"
import { NotificationPreferencesType } from "./dto/notification-preferences.type"
import { toNotificationPreferencesRequest, toNotificationPreferencesType } from "./notification-preferences.mapper"

@Resolver()
/** GraphQL door of notificationPreferences. */
export class NotificationPreferencesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The caller's subscription state and digest window on one channel; the defaults when nothing was ever written. */
    @Query(() => NotificationPreferencesType, {
        name: "notificationPreferences",
        description: "The caller's own notification preferences for one channel.",
    })
    async notificationPreferences(
        @CurrentPrincipal() principal: Principal,
        @Args("request", { nullable: true }) input?: NotificationPreferencesInput,
    ): Promise<NotificationPreferencesType> {
        const preferences = await this.queryBus.execute(
            new NotificationPreferencesQuery({ request: toNotificationPreferencesRequest(input), principal }),
        )
        return toNotificationPreferencesType(preferences)
    }
}
