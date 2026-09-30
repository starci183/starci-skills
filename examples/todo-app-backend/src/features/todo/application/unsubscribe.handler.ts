import { CommandHandler } from "@nestjs/cqrs"
import { PreferencesService } from "@modules/domain/notify"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UnsubscribeCommand } from "./unsubscribe.command"
import type { UnsubscribeResult } from "./unsubscribe.contracts"

@CommandHandler(UnsubscribeCommand)
/**
 * Marks the caller's channel unsubscribed. Every later admission reads the preference, so later events are suppressed
 * before any digest window or send; there is no cache to invalidate.
 */
export class UnsubscribeHandler extends ICQRSHandler<UnsubscribeCommand, UnsubscribeResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly preferences: PreferencesService,
    ) {
        super(logger)
    }

    protected override async process(command: UnsubscribeCommand): Promise<UnsubscribeResult> {
        const { request, principal } = command.params
        return this.preferences.unsubscribe({ personId: principal.id, channel: request.channel })
    }
}
