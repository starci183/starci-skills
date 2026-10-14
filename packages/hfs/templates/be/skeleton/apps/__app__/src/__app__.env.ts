import type { EnvSource } from "@modules/platform/config"
import { parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import type { {{appPascal}}Options } from "./{{app}}.options"

/** The {{app}} environment values required before composition. */
export interface {{appPascal}}Env extends {{appPascal}}Options {}

/** Reads the {{app}} environment; missing or invalid values fail boot, and secrets use `_FILE` first. */
export const read{{appPascal}}Env = (env: EnvSource): {{appPascal}}Env => ({
    server: parseServerConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    database: parsePrimaryDatabaseConfig(env),
})
