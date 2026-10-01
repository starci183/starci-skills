import { auditEntities, auditMigrations } from "@modules/domain/audit"
import { commissionEntities, commissionMigrations } from "@modules/domain/commission"
import { notifyEntities, notifyMigrations } from "@modules/domain/notify"
import { planEntities, planMigrations } from "@modules/domain/plan"
import { recurEntities, recurMigrations } from "@modules/domain/recur"
import { identityEntities, identityMigrations } from "@modules/domain/identity"
import { shareEntities, shareMigrations } from "@modules/domain/share"
import { taskEntities, taskMigrations } from "@modules/domain/task"
import { uploadEntities, uploadMigrations } from "@modules/domain/upload"
import type { DatabaseConnectionConfig, DatabaseConnectionOptions } from "@modules/platform/database"
import { inboxEntities, inboxMigrations } from "@modules/platform/inbox"
import { leaseEntities, leaseMigrations } from "@modules/platform/lease"
import { outboxEntities, outboxMigrations } from "@modules/platform/outbox"

/** Everything the migrate app needs from its environment: every connection with the entities and migrations of its owners. */
export interface MigrateAppOptions {
    /** The connections to migrate, in the order they run. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}

/** The primary connection with the entities and migrations of every owner of its tables. */
export const primaryConnectionOf = (database: DatabaseConnectionConfig): DatabaseConnectionOptions => ({
    ...database,
    entities: [
        ...identityEntities,
        ...taskEntities,
        ...shareEntities,
        ...planEntities,
        ...commissionEntities,
        ...recurEntities,
        ...notifyEntities,
        ...auditEntities,
        ...uploadEntities,
        ...leaseEntities,
        ...inboxEntities,
        ...outboxEntities,
    ],
    migrations: [
        ...identityMigrations,
        ...taskMigrations,
        ...shareMigrations,
        ...planMigrations,
        ...commissionMigrations,
        ...recurMigrations,
        ...notifyMigrations,
        ...auditMigrations,
        ...uploadMigrations,
        ...leaseMigrations,
        ...inboxMigrations,
        ...outboxMigrations,
    ],
})
