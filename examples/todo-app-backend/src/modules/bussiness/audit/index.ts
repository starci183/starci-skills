export { AuditModule } from './audit.module';
export { AuditLogService } from './audit-log.service';
export type { Clock, VerifyChainResult } from './audit-log.service';
export { AuditErasureService } from './audit-erasure.service';
export { AuditKeystoreService, SYSTEM_ACTOR_ID } from './audit-keystore.service';
export { AuditEventSubscriber } from './audit-event.subscriber';
export { AuditOperatorGuard, AUDIT_SEALED_ACTIONS } from './audit-operator.guard';
export { AuditOperatorService } from './audit-operator.service';
export type { OperatorFilter } from './audit-operator.guard';
export { ActorClaims } from './audit-operator-read';
export {
  assertOperatorRead,
  isOperatorRead,
  matchOperatorFilter,
  toAuditLineSummary,
} from './audit-operator-read';
export { AuditOperatorRoleNotAuthorizedException } from './audit-operator-role.guard';
export { AuditLogLineRecord } from './types/audit-log-line-record';
export type { ResolvedAuditLine } from './types/resolved-audit-line';
export { AuditErasureRequestRecord } from './types/audit-erasure-request-record';
export {
  ErasureRequestNotFoundException,
  ErasureRequestForbiddenException,
  ErasureRequestInvalidStateException,
  ErasureNotConfirmedException,
} from '@modules/shared/exceptions';
export { AppendLogLineCommand } from './append-log-line.command';
export type { AppendLogLineCommandParams, AppendLogLineCommandResult } from './append-log-line.command';
export { AppendLogLineHandler } from './append-log-line.handler';
export { RequestErasureCommand } from './request-erasure.command';
export type { RequestErasureCommandParams, RequestErasureCommandResult } from './request-erasure.command';
export { RequestErasureHandler } from './request-erasure.handler';
export { CompleteErasureCommand } from './complete-erasure.command';
export type { CompleteErasureCommandParams, CompleteErasureCommandResult } from './complete-erasure.command';
export { CompleteErasureHandler } from './complete-erasure.handler';
export { AuditLogQuery } from './audit-log.query';
export type { AuditLogQueryParams, AuditLogQueryResult, AuditLogLineSummaryResult } from './audit-log.query';
export { AuditLogHandler } from './audit-log.handler';
export { ExportMyDataQuery } from './export-my-data.query';
export type { ExportMyDataQueryParams, ExportMyDataQueryResult, ExportedLineResult } from './export-my-data.query';
export { ExportMyDataHandler } from './export-my-data.handler';
