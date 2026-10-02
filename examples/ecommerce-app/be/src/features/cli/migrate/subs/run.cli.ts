import { CommandRunner, SubCommand } from "nest-commander"
import { DataSource } from "typeorm"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import { InjectLogger, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectMigrateOptions, InjectOpenConnection } from "../migrate.decorators"
import type { MigrateOptions, OpenConnection } from "../migrate.options"

/** Opens the data source of one connection, uninitialized: its own migration ledger table, the schema never synchronized. */
export const openConnection: OpenConnection = (connection: DatabaseConnectionOptions) =>
    new DataSource({
        type: "postgres",
        url: connection.url.reveal(),
        entities: [...connection.entities],
        migrations: [...connection.migrations],
        migrationsTableName: `${connection.name}_migrations`,
        synchronize: false,
    })

/**
 * Applies the pending migrations of every connection in turn and answers the names it ran, by connection. The one runner of the
 * schema: this command runs it, and the test world runs it once per run over the same connections.
 */
export async function migrateConnections(
    connections: ReadonlyArray<DatabaseConnectionOptions>,
    open: OpenConnection,
): Promise<Readonly<Record<string, ReadonlyArray<string>>>> {
    const applied: Record<string, ReadonlyArray<string>> = {}
    for (const connection of connections) {
        const dataSource = open(connection)
        await dataSource.initialize()
        try {
            const ran = await dataSource.runMigrations()
            applied[connection.name] = ran.map((migration) => migration.name)
        } finally {
            await dataSource.destroy()
        }
    }
    return applied
}

@SubCommand({ name: "run", description: "Apply the pending migrations of every connection" })
/** `cli migrate run`: migrates every connection of the back end, in order, and logs what it applied. */
export class RunCli extends CommandRunner {
    constructor(
        @InjectMigrateOptions() private readonly options: MigrateOptions,
        @InjectOpenConnection() private readonly open: OpenConnection,
        @InjectLogger() private readonly logger: Logger,
    ) {
        super()
    }

    /** Runs the migrations of every connection and logs the applied names. */
    async run(): Promise<void> {
        const applied = await migrateConnections(this.options.connections, this.open)
        this.logger.info(LoggingLogEvent.MigrationsApplied, { applied })
    }
}
