import { QueryHandler } from "@nestjs/cqrs"
import { AuditLogService } from "@modules/domain/audit"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ExportMyDataResult } from "./export-my-data.contracts"
import { ExportMyDataQuery } from "./export-my-data.query"

@QueryHandler(ExportMyDataQuery)
/** Exports the own lines of the caller; after a completed erasure the key lookup finds nothing, so the export is empty by construction. */
export class ExportMyDataHandler extends ICQRSHandler<ExportMyDataQuery, ExportMyDataResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly log: AuditLogService,
    ) {
        super(logger)
    }

    protected override async process(query: ExportMyDataQuery): Promise<ExportMyDataResult> {
        const resolved = await this.log.findLinesForPerson(query.params.principal.id)
        return { lines: resolved.map((line) => ({ at: line.at, action: line.action, target: line.target })) }
    }
}
