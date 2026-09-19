import {
    Injectable 
} from "@nestjs/common"
import {
    QueryHandler 
} from "@nestjs/cqrs"
import {
    AbstractQueryHandler 
} from "@modules/platform/cqrs/abstract-handler"
import {
    isOperatorRead, matchOperatorFilter, toAuditLineSummary 
} from "./audit-operator-read"
import {
    AuditOperatorService 
} from "./audit-operator.service"
import {
    AuditLogService 
} from "./audit-log.service"
import {
    assertReadableActor, AuditLogQuery, AuditLogQueryResult, AuditLogLineSummaryResult 
} from "./audit-log.query"

/**
 * fr.audit.log.read's two authorized readers, dispatched on the caller's *verified* claim:
 * AuditOperatorService resolves the authenticated personId against a trusted server-side operator roster
 * (decision.audit.operator-role), and the same fail-closed check audit-operator-read.ts applies
 * everywhere decides the branch - an operator reads the whole chain, optionally filtered by action or
 * target, via AuditLogService.readAllLines; anyone else (and every actor while the roster is empty)
 * reads exactly their own lines, and an empty actor is refused before any line is touched
 * (assertReadableActor). The role is never taken from the request, so no caller can widen their own read:
 * the operator branch opens only when the deployment names the subject.
 */
@Injectable()
@QueryHandler(AuditLogQuery)
/** Decorated CQRS query handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class AuditLogHandler extends AbstractQueryHandler<AuditLogQuery, AuditLogQueryResult> {
    constructor(
    private readonly operatorService: AuditOperatorService,
    private readonly logService: AuditLogService,
    ) {
        super()
    }

    protected override async process(query: AuditLogQuery): Promise<AuditLogQueryResult> {
        const { params } = query
        assertReadableActor(params)
        const operator = isOperatorRead(this.operatorService.claimFor(params.personId))
        const records = operator
            ? await this.logService.readAllLines()
            : await this.logService.findLinesForPerson(params.personId)
        const visible = operator ? records.filter(record => matchOperatorFilter(record,
            params)) : records
        const lines: Array<AuditLogLineSummaryResult> = visible.map(toAuditLineSummary)
        return {
            lines 
        }
    }
}
