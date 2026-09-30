import { CommandHandler } from "@nestjs/cqrs"
import { SessionService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PurgeLapsedSessionsCommand } from "./purge-lapsed-sessions.command"
import type { PurgeLapsedSessionsResult } from "./purge-lapsed-sessions.contracts"

@CommandHandler(PurgeLapsedSessionsCommand)
/** Deletes the sessions that lapsed at or before the tick, through the session service. */
export class PurgeLapsedSessionsHandler extends ICQRSHandler<PurgeLapsedSessionsCommand, PurgeLapsedSessionsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sessions: SessionService,
    ) {
        super(logger)
    }

    protected override async process(command: PurgeLapsedSessionsCommand): Promise<PurgeLapsedSessionsResult> {
        const { at } = command.params.request
        return this.sessions.purgeLapsed({ at })
    }
}
