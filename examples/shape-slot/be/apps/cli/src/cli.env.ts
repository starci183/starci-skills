import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"

/** The cli's primary database configuration before entities and migrations are bound. */
export interface CliEnv extends ReturnType<typeof parsePrimaryDatabaseConfig> {}

/** Reads the cli environment with no defaults; database secret readers prefer mounted files. */
export const readCliEnv = (env: EnvSource): CliEnv => parsePrimaryDatabaseConfig(env)
