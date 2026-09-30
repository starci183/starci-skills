import { AuditErasureRequestEntity } from "./persistence/entities/audit-erasure-request.entity"
import { AuditKeyEntity } from "./persistence/entities/audit-key.entity"
import { AuditLogLineEntity } from "./persistence/entities/audit-log-line.entity"
import { CreateAuditTables1758246000000 } from "./persistence/migrations/1758246000000-create-audit-tables"

/** The entities of the audit capability, for the connection that holds them. */
export const auditEntities = [AuditLogLineEntity, AuditKeyEntity, AuditErasureRequestEntity]

/** The migrations of the audit capability, in the order they run. */
export const auditMigrations = [CreateAuditTables1758246000000]

export { AUDIT_APPEND_QUEUE, toAuditAppendMessage } from "./audit-append.policy"
export { AuditErasureService } from "./audit-erasure.service"
export { AuditLogService } from "./audit-log.service"
export { AuditAction, SYSTEM_ACTOR_ID } from "./audit.contracts"
export type { AuditAppendPayload, ErasureRequestView, ResolvedAuditLine } from "./audit.contracts"
export { AuditModule } from "./audit.module"
export { AUDIT_ERROR_KINDS, AuditError, AuditErrorCode } from "./errors/audit.error"
export { AUDIT_MESSAGES } from "./messages/audit.messages"
