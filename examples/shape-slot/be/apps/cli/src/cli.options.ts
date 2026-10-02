import { noteEntities, noteMigrations } from "@modules/domain/note"
import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"

/** Everything the cli app needs from its environment: every connection with the entities and migrations of its owners. */
export interface CliAppOptions {
    /** The connections the migrate and seed commands run on, in the order they run them. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}

/** The primary database: the notes. */
export const primaryConnectionOf = (env: EnvSource): DatabaseConnectionOptions => ({
    ...parsePrimaryDatabaseConfig(env),
    entities: noteEntities,
    migrations: noteMigrations,
})

/** Parses the cli options from the environment: one entry per connection, each built by its own function above. */
export const parseCliAppOptions = (env: EnvSource): CliAppOptions => ({
    connections: [primaryConnectionOf(env)],
})
