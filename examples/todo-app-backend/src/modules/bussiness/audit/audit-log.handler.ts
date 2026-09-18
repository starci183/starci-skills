import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { isOperatorRead, matchOperatorFilter, toAuditLineSummary } from './audit-operator-read';
import { AuditLogService } from './audit-log.service';
import { assertReadableActor, AuditLogQuery, AuditLogQueryResult, AuditLogLineSummaryResult } from './audit-log.query';

/**
 * fr.audit.log.read's two authorized readers, dispatched on the caller's resolved claim:
 * an operator (the same fail-closed check audit-operator-read.ts applies everywhere) reads the whole
 * chain, optionally filtered by action or target; anyone else reads exactly their own lines, and an
 * empty actor is refused before any line is touched (assertReadableActor). gap.audit.operator-role
 * states the example has no role claim on the session shape today - SessionService hands every
 * resolver a SessionRecord of {token, personId, issuedAt, expiresAt} and nothing else - so in this
 * app as built only the own-lines branch is ever reachable, which is the honest subset, not a fake
 * operator grant.
 */
@Injectable()
@QueryHandler(AuditLogQuery)
export class AuditLogHandler implements IQueryHandler<AuditLogQuery, AuditLogQueryResult> {
  constructor(private readonly logService: AuditLogService) {}

  async execute(query: AuditLogQuery): Promise<AuditLogQueryResult> {
    const { params } = query;
    assertReadableActor(params);
    const operator = isOperatorRead({ personId: params.personId, role: params.role });
    const records = operator
      ? await this.logService.readAllLines()
      : await this.logService.findLinesForPerson(params.personId);
    const visible = operator ? records.filter(record => matchOperatorFilter(record, params)) : records;
    const lines: AuditLogLineSummaryResult[] = visible.map(toAuditLineSummary);
    return { lines };
  }
}
