import type { DatabaseConnectionOptions } from "./database.options"
import type { OpenConnection } from "./database.port"

/** What a migrate run applied: the migration names it ran, by connection. */
export interface AppliedMigrations {
    /** The names of the migrations run on the connection, in the order they ran. */
    readonly [connection: string]: ReadonlyArray<string>
}

/**
 * Applies the pending migrations of every connection in turn and answers the names it ran, by connection. The one runner of the
 * schema: the cli migrate command runs it, and a test world runs it over the same connections.
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
