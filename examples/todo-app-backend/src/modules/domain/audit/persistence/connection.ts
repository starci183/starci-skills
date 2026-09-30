import { PRIMARY_CONNECTION } from "@modules/platform/database"
import { AuditErasureRequestEntity } from "./entities/audit-erasure-request.entity"
import { AuditKeyEntity } from "./entities/audit-key.entity"
import { AuditLogLineEntity } from "./entities/audit-log-line.entity"
import { CreateAuditTables1758246000000 } from "./migrations/1758246000000-create-audit-tables"

/** The connection that holds the tables of the audit capability. */
export const CONNECTION = PRIMARY_CONNECTION

/** The entities of the audit capability, for the connection that holds them. */
export const auditEntities = [AuditLogLineEntity, AuditKeyEntity, AuditErasureRequestEntity]

/** The migrations of the audit capability, in the order they run. */
export const auditMigrations = [CreateAuditTables1758246000000]
