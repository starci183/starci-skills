import type { EnvSource } from "@modules/platform/config"
import { parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import { parseSupabaseConfig } from "@modules/integrations/supabase"
import type { ApiOptions } from "./api.options"

/** The API environment values required before composition. */
export interface ApiEnv extends ApiOptions {}

/** Reads the API environment; missing or invalid values fail boot, and secrets use `_FILE` first. */
export const readApiEnv = (env: EnvSource): ApiEnv => ({
    server: parseServerConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    database: parsePrimaryDatabaseConfig(env),
    supabase: parseSupabaseConfig(env),
})
