import type { EnvSource, Secret } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"

/** The cli's primary database environment values, before entities and migrations are bound. */
export interface CliEnv {
    /** The logical connection name declared in `hfs.json`. */
    readonly name: string
    /** The primary database connection URL, read through the secret source. */
    readonly url: Secret
}

/** Reads the required cli connection before composition; its secret uses `_FILE` first and has no default. */
export const readCliEnv = (env: EnvSource): CliEnv => parsePrimaryDatabaseConfig(env)
