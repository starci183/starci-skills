import type { MigrationInterface } from "typeorm"
import type { Secret } from "@modules/platform/config"

/** An entity class as TypeORM registers it. */
export type EntityClass = new () => object

/** A migration class as TypeORM runs it. */
export type MigrationClass = new () => MigrationInterface

/** What a connection config parser reads from the environment: the logical name and where the database is. */
export interface DatabaseConnectionConfig {
    /** The logical connection name, as declared in `hfs.json`. */
    readonly name: string
    /** The connection URL; it may embed credentials. */
    readonly url: Secret
}

/** One connection as the app composes it: its config plus the entities and migrations of the owners whose tables it holds. */
export interface DatabaseConnectionOptions extends DatabaseConnectionConfig {
    /** Every entity of the connection, concatenated from the owner indexes. */
    readonly entities: ReadonlyArray<EntityClass>
    /** Every migration of the connection, concatenated from the owner indexes. */
    readonly migrations: ReadonlyArray<MigrationClass>
}

/** Options of the database capability. */
export interface DatabaseOptions {
    /** The connections this app opens; one per physical database. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}
