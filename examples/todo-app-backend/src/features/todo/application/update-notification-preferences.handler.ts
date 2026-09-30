import { CommandHandler } from "@nestjs/cqrs"
import { PreferencesService } from "@modules/domain/notify"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
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
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly preferences: PreferencesService,
    ) {
        super(logger)
    }

    protected override async process(
        command: UpdateNotificationPreferencesCommand,
    ): Promise<UpdateNotificationPreferencesResult> {
        const { request, principal } = command.params
        return this.entityManager.transaction(async (manager) => {
            const outcome = await this.preferences.update({
                manager,
                personId: principal.id,
                channel: request.channel,
                patch: { unsubscribed: request.unsubscribed, digestWindowMinutes: request.digestWindowMinutes },
            })
            if (outcome.kind === "refused") return outcome
            const { channel, unsubscribed, digestWindowMinutes } = outcome.value
            return ok({ channel, unsubscribed, digestWindowMinutes })
        })
    }
}
