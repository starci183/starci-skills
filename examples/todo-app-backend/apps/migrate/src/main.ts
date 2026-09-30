import "reflect-metadata"
import { DataSource } from "typeorm"
import { SystemClock } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import { JsonLoggerService, LoggingLogEvent } from "@modules/platform/logging"
import { primaryConnectionOf } from "./migrate.options"
import type { MigrateAppOptions } from "./migrate.options"

/** Applies the pending migrations of one connection and answers the names it ran; each connection keeps its own ledger table. */
async function migrate(connection: DatabaseConnectionOptions): Promise<ReadonlyArray<string>> {
    const dataSource = new DataSource({
        type: "postgres",
        url: connection.url.reveal(),
        entities: [...connection.entities],
        migrations: [...connection.migrations],
        migrationsTableName: `${connection.name}_migrations`,
        synchronize: false,
    })
    await dataSource.initialize()
    try {
        const applied = await dataSource.runMigrations()
        return applied.map((migration) => migration.name)
    } finally {
        await dataSource.destroy()
    }
}

/** Migrates every connection of the options in turn and answers the migration names each one ran; the e2e world calls it once against its containers. */
export async function bootstrap(options: MigrateAppOptions): Promise<Readonly<Record<string, ReadonlyArray<string>>>> {
    const applied: Record<string, ReadonlyArray<string>> = {}
    for (const connection of options.connections) {
        applied[connection.name] = await migrate(connection)
    }
    return applied
}

/** The one process that changes a schema: migrates every connection and exits; the api and the worker start after it. */
if (require.main === module) {
    bootstrap({ connections: [primaryConnectionOf(parsePrimaryDatabaseConfig(EnvSource.fromProcess()))] })
        .then((applied) => new JsonLoggerService(new SystemClock(), process.stdout, process.stderr).info(LoggingLogEvent.MigrationsApplied, { applied }))
        .catch((error: unknown) => {
            new JsonLoggerService(new SystemClock(), process.stdout, process.stderr).error(LoggingLogEvent.StartupFailed, error, { service: "migrate" })
            process.exit(1)
        })
}
