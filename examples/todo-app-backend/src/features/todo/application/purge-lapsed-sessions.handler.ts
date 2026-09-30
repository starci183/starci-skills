import { CommandHandler } from "@nestjs/cqrs"
import { SessionService } from "@modules/domain/session"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { EntityManager } from "typeorm"
import { PurgeLapsedSessionsCommand } from "./purge-lapsed-sessions.command"
import type { PurgeLapsedSessionsResult } from "./purge-lapsed-sessions.contracts"

@CommandHandler(PurgeLapsedSessionsCommand)
/**
 * Deletes the sessions that lapsed at or before the tick. Expiry is already enforced on read, so this is housekeeping:
 * a stopped job can never keep a session alive past its time.
 */
export class PurgeLapsedSessionsHandler extends ICQRSHandler<PurgeLapsedSessionsCommand, PurgeLapsedSessionsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly sessions: SessionService,
    ) {
        super(logger)
    }

    protected override async process(command: PurgeLapsedSessionsCommand): Promise<PurgeLapsedSessionsResult> {
        const { at } = command.params.request
        const purged = await this.entityManager.transaction((manager) => this.sessions.purgeLapsed({ manager, at }))
        return { purged }
    }
}
