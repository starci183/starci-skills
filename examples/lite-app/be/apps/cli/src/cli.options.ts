import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"

/** Everything the lite cli needs: the least-privilege Supabase PostgreSQL connection. */
export interface CliAppOptions {
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}

/** Reads the one declared connection without adding entities or TypeORM migrations. */
export const parseCliAppOptions = (env: EnvSource): CliAppOptions => ({
    connections: [parsePrimaryDatabaseConfig(env)],
})
