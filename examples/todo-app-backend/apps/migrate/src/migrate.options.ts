import { auditEntities, auditMigrations } from "@modules/domain/audit"
import { notifyEntities, notifyMigrations } from "@modules/domain/notify"
import { planEntities, planMigrations } from "@modules/domain/plan"
import { recurEntities, recurMigrations } from "@modules/domain/recur"
import { sessionEntities, sessionMigrations } from "@modules/domain/session"
import { shareEntities, shareMigrations } from "@modules/domain/share"
import { taskEntities, taskMigrations } from "@modules/domain/task"
import { uploadEntities, uploadMigrations } from "@modules/domain/upload"
import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import { inboxEntities, inboxMigrations } from "@modules/platform/inbox"
import { leaseEntities, leaseMigrations } from "@modules/platform/lease"
import { outboxEntities, outboxMigrations } from "@modules/platform/outbox"

/** Everything the migrate app needs from its environment: every connection with the entities and migrations of its owners. */
export interface MigrateAppOptions {
    /** The connections to migrate, in the order they run. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}

/** Parses the migrate options from the environment. */
export const parseMigrateAppOptions = (env: EnvSource): MigrateAppOptions => ({
    connections: [
        {
            ...parsePrimaryDatabaseConfig(env),
            entities: [
                ...sessionEntities,
                ...taskEntities,
                ...shareEntities,
                ...planEntities,
                ...recurEntities,
                ...notifyEntities,
                ...auditEntities,
                ...uploadEntities,
                ...leaseEntities,
                ...inboxEntities,
                ...outboxEntities,
            ],
            migrations: [
                ...sessionMigrations,
                ...taskMigrations,
                ...shareMigrations,
                ...planMigrations,
                ...recurMigrations,
                ...notifyMigrations,
                ...auditMigrations,
                ...uploadMigrations,
                ...leaseMigrations,
                ...inboxMigrations,
                ...outboxMigrations,
            ],
        },
    ],
})
