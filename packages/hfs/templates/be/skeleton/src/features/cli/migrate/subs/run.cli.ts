import { CommandRunner, SubCommand } from "nest-commander"
import { InjectConnectionSource, InjectDatabaseOptions } from "@modules/platform/database"
import type { DatabaseConnectionOptions, DatabaseOptions, OpenConnection } from "@modules/platform/database"
import { InjectLogger, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"

/** What a migrate run applied: the migration names it ran, by connection. */
export interface AppliedMigrations {
    /** The names of the migrations run on the connection, in the order they ran. */
    readonly [connection: string]: ReadonlyArray<string>
}

/**
 * Applies the pending migrations of every connection in turn and answers the names it ran, by connection. The one runner of the
 * schema: this command runs it, and a test world runs it over the same connections.
 */
export async function migrateConnections(
    connections: ReadonlyArray<DatabaseConnectionOptions>,
    open: OpenConnection,
): Promise<AppliedMigrations> {
    const applied: Record<string, ReadonlyArray<string>> = {}
    for (const connection of connections) {
        const source = open(connection)
        await source.initialize()
        try {
            const ran = await source.runMigrations()
            applied[connection.name] = ran.map((migration) => migration.name)
        } finally {
            await source.destroy()
        }
    }
    return applied
}

@SubCommand({
    name: "run",
    description: "Apply the pending migrations of every connection",
})
/** `cli migrate run`: migrates every connection of the back end, in order, and logs what it applied. */
export class RunCli extends CommandRunner {
    constructor(
        @InjectDatabaseOptions() private readonly database: DatabaseOptions,
        @InjectConnectionSource() private readonly open: OpenConnection,
        @InjectLogger() private readonly logger: Logger,
    ) {
        super()
    }

    /** Runs the migrations of every connection and logs the applied names. */
    async run(): Promise<void> {
        const applied = await migrateConnections(this.database.connections, this.open)
        this.logger.info(LoggingLogEvent.MigrationsApplied, { applied })
    }
}
