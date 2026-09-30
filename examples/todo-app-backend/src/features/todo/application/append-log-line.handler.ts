import { CommandHandler } from "@nestjs/cqrs"
import { AuditLogService } from "@modules/domain/audit"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { EntityManager } from "typeorm"
import { AppendLogLineCommand } from "./append-log-line.command"
import type { AppendLogLineResult } from "./append-log-line.contracts"

@CommandHandler(AppendLogLineCommand)
/** Appends one hash-chained, sealed line in its own transaction, so the chain lock and the line commit together. */
export class AppendLogLineHandler extends ICQRSHandler<AppendLogLineCommand, AppendLogLineResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly log: AuditLogService,
    ) {
        super(logger)
    }

    protected override async process(command: AppendLogLineCommand): Promise<AppendLogLineResult> {
        const { request } = command.params
        return this.entityManager.transaction((manager) =>
            this.log.append({
                manager,
                actorId: request.actorId,
                action: request.action,
                target: request.target,
                at: request.at,
            }),
        )
    }
}
