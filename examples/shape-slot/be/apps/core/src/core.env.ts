import type { EnvSource } from "@modules/platform/config"
import { parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import type { CoreOptions } from "./core.options"

/** The core environment values parsed before app composition. */
export interface CoreEnv extends CoreOptions {}

/** Reads the core environment; missing or invalid values fail boot and secret readers prefer mounted files. */
export const readCoreEnv = (env: EnvSource): CoreEnv => ({
    server: parseServerConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    database: parsePrimaryDatabaseConfig(env),
})
