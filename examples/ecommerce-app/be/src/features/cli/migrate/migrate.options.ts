import type { DataSource } from "typeorm"
import type { DatabaseConnectionOptions } from "@modules/platform/database"

/** Opens the data source of one connection, uninitialized; the migrate command initializes, migrates and destroys it. */
export type OpenConnection = (connection: DatabaseConnectionOptions) => DataSource

/** Options of the migrate group: the connections it migrates, in order. */
export interface MigrateOptions {
    /** Every connection of the back end with the entities and migrations of its owners. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}
