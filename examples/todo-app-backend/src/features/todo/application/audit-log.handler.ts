import { QueryHandler } from "@nestjs/cqrs"
import { AuditErrorCode, AuditLogService } from "@modules/domain/audit"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { AuditLogResult } from "./audit-log.contracts"
import { AuditLogQuery } from "./audit-log.query"

@QueryHandler(AuditLogQuery)
/**
 * The two authorized readers of the log, decided from the roles of the principal: an administrator reads the whole chain,
 * optionally narrowed by action or target; everyone else reads exactly their own lines and the filter is ignored. A
 * caller without an identity is refused before any line is touched.
 */
export class AuditLogHandler extends ICQRSHandler<AuditLogQuery, AuditLogResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly log: AuditLogService,
    ) {
        super(logger)
    }

    protected override async process(query: AuditLogQuery): Promise<AuditLogResult> {
        const { request, principal } = query.params
        if (!principal.id) return refused(AuditErrorCode.OperatorRoleNotAuthorized)
        const resolved = principal.roles.includes("admin")
            ? await this.log.readChain({ action: request.action, target: request.target })
            : await this.log.findLinesForPerson(principal.id)
        return ok({ lines: resolved.map((line) => ({ at: line.at, action: line.action, target: line.target })) })
    }
}
