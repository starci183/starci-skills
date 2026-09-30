import "reflect-metadata"
import { DataSource } from "typeorm"
import { SystemClock } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { parseMigrateAppOptions } from "./migrate.options"

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

/** The one process that changes a schema: migrates every connection in turn and exits; the apis start after it. */
async function bootstrap(): Promise<void> {
    const options = parseMigrateAppOptions(EnvSource.fromProcess())
    const applied: Record<string, ReadonlyArray<string>> = {}
    for (const connection of options.connections) {
        applied[connection.name] = await migrate(connection)
    }
    createJsonLogger(new SystemClock()).info(LoggingLogEvent.MigrationsApplied, { applied })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClock()).error(LoggingLogEvent.StartupFailed, error, { service: "migrate" })
    process.exit(1)
})
