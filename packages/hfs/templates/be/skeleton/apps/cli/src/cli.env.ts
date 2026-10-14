import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"

/** Parses the cli's primary database configuration before composition or command execution. */
export const parseCliEnv = (env: EnvSource): ReturnType<typeof parsePrimaryDatabaseConfig> => parsePrimaryDatabaseConfig(env)
