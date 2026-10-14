import type { DatabaseConnectionOptions } from "@modules/platform/database"

/** Everything the lite cli needs: the least-privilege Supabase PostgreSQL connection. */
export interface CliAppOptions {
    /** The connections the built-in migrate and seed groups operate on. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}

/** Binds the parsed connection without adding entities or TypeORM migrations. */
export const createCliAppOptions = (primary: DatabaseConnectionOptions): CliAppOptions => ({
    connections: [primary],
})
