import { QueryHandler } from "@nestjs/cqrs"
import { AuditLogService } from "@modules/domain/audit"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ExportMyDataResult } from "./export-my-data.contracts"
import { ExportMyDataQuery } from "./export-my-data.query"

@QueryHandler(ExportMyDataQuery)
/** Exports the own lines of the caller; after a completed erasure the export is empty by construction. */
export class ExportMyDataHandler extends ICQRSHandler<ExportMyDataQuery, ExportMyDataResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly log: AuditLogService,
    ) {
        super(logger)
    }

    protected override async process(query: ExportMyDataQuery): Promise<ExportMyDataResult> {
        const { principal } = query.params
        return this.log.exportFor(principal.id)
    }
}
