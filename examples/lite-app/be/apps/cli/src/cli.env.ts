import type { EnvSource, Secret } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"

/** The cli's primary database configuration before command composition. */
export interface CliEnv {
    /** The logical connection name declared in `hfs.json`. */
    readonly name: string
    /** The Supabase PostgreSQL provider. */
    readonly provider: "supabase"
    /** The least-privilege database connection URL, read through the secret source. */
    readonly url: Secret
    /** The isolated PostgreSQL schema. */
    readonly schema?: string
}

/** Reads the cli environment with no defaults; database secret readers prefer mounted files. */
export const readCliEnv = (env: EnvSource): CliEnv => parsePrimaryDatabaseConfig(env)
