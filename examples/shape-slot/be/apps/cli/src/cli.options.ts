import { noteEntities, noteMigrations } from "@modules/domain/note"
import type { DatabaseConnectionConfig, DatabaseConnectionOptions } from "@modules/platform/database"

/** Everything the cli app needs from its environment: every connection with the entities and migrations of its owners. */
export interface CliAppOptions {
    /** The connections the migrate and seed commands run on, in the order they run them. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}

/** The primary database: the notes. */
export const primaryConnectionOf = (primary: DatabaseConnectionConfig): DatabaseConnectionOptions => ({
    ...primary,
    name: "primary",
    entities: noteEntities,
    migrations: noteMigrations,
})

/** Binds the parsed cli configuration to each connection's entities and migrations. */
export const createCliAppOptions = (primary: DatabaseConnectionConfig): CliAppOptions => ({
    connections: [primaryConnectionOf(primary)],
})
