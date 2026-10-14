import type { EnvSource } from "@modules/platform/config"
import { parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import type { {{appPascal}}Options } from "./{{app}}.options"

/** Parses the {{app}} environment into typed options; missing or invalid values fail boot. */
export const parse{{appPascal}}Env = (env: EnvSource): {{appPascal}}Options => ({
    server: parseServerConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    database: parsePrimaryDatabaseConfig(env),
})
