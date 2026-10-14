import type { EnvSource } from "@modules/platform/config"
import { parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import { parseSupabaseConfig } from "@modules/integrations/supabase"
import type { ApiOptions } from "./api.options"

/** Parses the API environment into typed options; missing or invalid values fail boot. */
export const parseApiEnv = (env: EnvSource): ApiOptions => ({
    server: parseServerConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    database: parsePrimaryDatabaseConfig(env),
    supabase: parseSupabaseConfig(env),
})
