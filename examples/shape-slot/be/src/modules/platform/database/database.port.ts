import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { DatabaseConnectionOptions, DatabaseOptions } from "./database.options"
import type { SqlText } from "./database.sql"
import type { ReadSeedFiles } from "./seed-connections.client"

/** One applied migration, as the data source answers it. */
export interface AppliedMigration {
    /** The migration class name. */
    readonly name: string
}

/**
 * The data source of one connection as a one-off action drives it: initialized, migrated or seeded, then destroyed. A typeorm
 * `DataSource` is one; the cli commands depend on this port alone.
 */
export interface ConnectionSource {
    /** Opens the pool. */
    initialize(): Promise<unknown>
    /** Applies the pending migrations and answers the ones it ran. */
    runMigrations(): Promise<ReadonlyArray<AppliedMigration>>
    /** Runs SQL text as written. */
    query(text: SqlText): Promise<unknown>
    /** Closes the pool. */
    destroy(): Promise<void>
}

/** Opens the data source of one connection, uninitialized; the caller initializes, uses and destroys it. */
export type OpenConnection = (connection: DatabaseConnectionOptions) => ConnectionSource

/** Token of the options of the database capability: every connection the app declares, with its entities and migrations. */
export const DATABASE_OPTIONS: unique symbol = Symbol("platform.database.options")

/** Token of the function that opens the data source of one connection. */
export const CONNECTION_SOURCE: unique symbol = Symbol("platform.database.connection-source")

/** Injects the options of the database capability. Parameter type: DatabaseOptions. */
export const InjectDatabaseOptions = (): TypedParameterDecorator<DatabaseOptions> =>
    injector<DatabaseOptions>(DATABASE_OPTIONS)

/** Injects the function that opens the data source of one connection. Parameter type: OpenConnection. */
export const InjectConnectionSource = (): TypedParameterDecorator<OpenConnection> =>
    injector<OpenConnection>(CONNECTION_SOURCE)

/** Token of the function that reads the seed files of a directory. */
export const READ_SEED_FILES: unique symbol = Symbol("platform.database.read-seed-files")

/** Injects the function that reads the seed files of a directory. Parameter type: ReadSeedFiles. */
export const InjectReadSeedFiles = (): TypedParameterDecorator<ReadSeedFiles> =>
    injector<ReadSeedFiles>(READ_SEED_FILES)
