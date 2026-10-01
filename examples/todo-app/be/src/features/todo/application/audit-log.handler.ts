import { QueryHandler } from "@nestjs/cqrs"
import { AuditLogService } from "@modules/domain/audit"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AuditLogResult } from "./audit-log.contracts"
import { AuditLogQuery } from "./audit-log.query"

@QueryHandler(AuditLogQuery)
/** Reads the audit lines the caller may read: the whole chain for an administrator, their own lines otherwise. */
export class AuditLogHandler extends ICQRSHandler<AuditLogQuery, AuditLogResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly log: AuditLogService,
    ) {
        super(logger)
    }

    protected override async process(query: AuditLogQuery): Promise<AuditLogResult> {
        return this.log.readAs({
            principalId: query.params.principal.id,
            roles: query.params.principal.roles,
            action: query.params.request.action,
            target: query.params.request.target,
        })
    }
}
