import { DynamicModule } from '@nestjs/common';
import { ListTasksSingleQueryModule } from './task/list-tasks/list-tasks.module';
import { AuditLogSingleQueryModule } from './audit/audit-log/audit-log.module';
import { ExportMyDataSingleQueryModule } from './audit/export-my-data/export-my-data.module';

/** Every GraphQL query module the todo API exposes, gathered exactly like nivo's own
 * `queries/index.ts` gathers `QUERY_MODULES`. */
export const QUERY_MODULES: Array<DynamicModule | (new () => unknown)> = [
  ListTasksSingleQueryModule.register({}),
  AuditLogSingleQueryModule.register({}),
  ExportMyDataSingleQueryModule.register({}),
];
