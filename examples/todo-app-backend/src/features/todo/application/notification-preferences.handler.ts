import { QueryHandler } from "@nestjs/cqrs"
import { PreferencesService } from "@modules/domain/notify"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { NotificationPreferencesResult } from "./notification-preferences.contracts"
import { NotificationPreferencesQuery } from "./notification-preferences.query"

@QueryHandler(NotificationPreferencesQuery)
/** Reads the caller's own preferences on a channel; a person who never wrote one reads the defaults. */
export class NotificationPreferencesHandler extends ICQRSHandler<
    NotificationPreferencesQuery,
    NotificationPreferencesResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly preferences: PreferencesService,
    ) {
        super(logger)
    }

    protected override async process(query: NotificationPreferencesQuery): Promise<NotificationPreferencesResult> {
        const { request, principal } = query.params
        const preference = await this.preferences.get({ personId: principal.id, channel: request.channel })
        return {
            channel: preference.channel,
            unsubscribed: preference.unsubscribed,
            digestWindowMinutes: preference.digestWindowMinutes,
        }
    }
}
