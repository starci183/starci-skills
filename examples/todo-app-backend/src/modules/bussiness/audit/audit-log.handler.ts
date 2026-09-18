import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AuditLogService } from './audit-log.service';
import { AuditLogQuery, AuditLogQueryResult, AuditLogLineSummaryResult } from './audit-log.query';

/** See audit-log.query.ts's comment: the person's-own-lines subset of fr.audit.log.read this example can
 * honestly authorize today. */
@Injectable()
@QueryHandler(AuditLogQuery)
export class AuditLogHandler implements IQueryHandler<AuditLogQuery, AuditLogQueryResult> {
  constructor(private readonly logService: AuditLogService) {}

  async execute(query: AuditLogQuery): Promise<AuditLogQueryResult> {
    const records = await this.logService.findLinesForPerson(query.params.personId);
    const lines: AuditLogLineSummaryResult[] = records.map(record => ({
      at: record.at,
      action: record.action,
      target: record.target,
    }));
    return { lines };
  }
}
