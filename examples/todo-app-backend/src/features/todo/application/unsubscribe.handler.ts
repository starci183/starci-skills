import { CommandHandler } from "@nestjs/cqrs"
import { PreferencesService } from "@modules/domain/notify"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
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
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly preferences: PreferencesService,
    ) {
        super(logger)
    }

    protected override async process(command: UnsubscribeCommand): Promise<UnsubscribeResult> {
        const { request, principal } = command.params
        return this.entityManager.transaction(async (manager) => {
            const outcome = await this.preferences.update({
                manager,
                personId: principal.id,
                channel: request.channel,
                patch: { unsubscribed: true },
            })
            if (outcome.kind === "refused") return outcome
            return ok({ channel: outcome.value.channel, unsubscribed: true as const })
        })
    }
}
