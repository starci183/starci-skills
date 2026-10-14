import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"

/** The cli's primary database environment values, before entities and migrations are bound. */
export interface CliEnv extends ReturnType<typeof parsePrimaryDatabaseConfig> {}

/** Reads the required cli connection before composition; its secret uses `_FILE` first and has no default. */
export const readCliEnv = (env: EnvSource): CliEnv => parsePrimaryDatabaseConfig(env)
