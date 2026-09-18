import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AuditLogService } from './audit-log.service';
import { ExportMyDataQuery, ExportMyDataQueryResult, ExportedLineResult } from './export-my-data.query';

/** fr.audit.export. */
@Injectable()
@QueryHandler(ExportMyDataQuery)
export class ExportMyDataHandler implements IQueryHandler<ExportMyDataQuery, ExportMyDataQueryResult> {
  constructor(private readonly logService: AuditLogService) {}

  async execute(query: ExportMyDataQuery): Promise<ExportMyDataQueryResult> {
    const records = await this.logService.exportForPerson(query.params.personId);
    const lines: ExportedLineResult[] = records.map(record => ({
      at: record.at,
      action: record.action,
      target: record.target,
    }));
    return { lines };
  }
}
