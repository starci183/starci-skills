import { CommandHandler } from "@nestjs/cqrs"
import { PreferencesService } from "@modules/domain/notify"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpdateNotificationPreferencesCommand } from "./update-notification-preferences.command"
import type { UpdateNotificationPreferencesResult } from "./update-notification-preferences.contracts"

@CommandHandler(UpdateNotificationPreferencesCommand)
/** Writes the caller's own preferences on a channel; it takes effect for every event admitted after it. */
export class UpdateNotificationPreferencesHandler extends ICQRSHandler<
    UpdateNotificationPreferencesCommand,
    UpdateNotificationPreferencesResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly preferences: PreferencesService,
    ) {
        super(logger)
    }

    protected override async process(
        command: UpdateNotificationPreferencesCommand,
    ): Promise<UpdateNotificationPreferencesResult> {
        const { request, principal } = command.params
        return this.preferences.change({
            personId: principal.id,
            channel: request.channel,
            unsubscribed: request.unsubscribed,
            digestWindowMinutes: request.digestWindowMinutes,
        })
    }
}
