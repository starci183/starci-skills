import { CommandHandler } from "@nestjs/cqrs"
import { AuditLogService } from "@modules/domain/audit"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AppendLogLineCommand } from "./append-log-line.command"
import type { AppendLogLineResult } from "./append-log-line.contracts"

@CommandHandler(AppendLogLineCommand)
/** Appends the line of one queue delivery: claimed once, sealed, hash-chained, committed with the chain lock. */
export class AppendLogLineHandler extends ICQRSHandler<AppendLogLineCommand, AppendLogLineResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly log: AuditLogService,
    ) {
        super(logger)
    }

    protected override async process(command: AppendLogLineCommand): Promise<AppendLogLineResult> {
        return this.log.appendDelivered(command.params.request)
    }
}
