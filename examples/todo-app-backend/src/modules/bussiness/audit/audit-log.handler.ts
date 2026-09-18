import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { isOperatorRead, matchOperatorFilter, toAuditLineSummary } from './audit-operator-read';
import { AuditOperatorService } from './audit-operator.service';
import { AuditLogService } from './audit-log.service';
import { assertReadableActor, AuditLogQuery, AuditLogQueryResult, AuditLogLineSummaryResult } from './audit-log.query';

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
export class AuditLogHandler implements IQueryHandler<AuditLogQuery, AuditLogQueryResult> {
  constructor(
    private readonly logService: AuditLogService,
    private readonly operatorService: AuditOperatorService,
  ) {}

  async execute(query: AuditLogQuery): Promise<AuditLogQueryResult> {
    const { params } = query;
    assertReadableActor(params);
    const operator = isOperatorRead(this.operatorService.claimFor(params.personId));
    const records = operator
      ? await this.logService.readAllLines()
      : await this.logService.findLinesForPerson(params.personId);
    const visible = operator ? records.filter(record => matchOperatorFilter(record, params)) : records;
    const lines: AuditLogLineSummaryResult[] = visible.map(toAuditLineSummary);
    return { lines };
  }
}
