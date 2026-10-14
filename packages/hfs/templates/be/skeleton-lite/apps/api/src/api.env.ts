import type { EnvSource } from "@modules/platform/config"
import { parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import { parseSupabaseConfig } from "@modules/integrations/supabase"

/** The API environment values required before composition. */
export interface ApiEnv {
    /** The HTTP listener. */
    readonly server: ReturnType<typeof parseServerConfig>
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: ReturnType<typeof parseHttpSecurityConfig>
    /** The least-privilege PostgreSQL connection to the Supabase project. */
    readonly database: ReturnType<typeof parsePrimaryDatabaseConfig>
    /** Supabase Auth, Storage and token-verification configuration. */
    readonly supabase: ReturnType<typeof parseSupabaseConfig>
}

/** Reads the API environment; missing or invalid values fail boot, and secrets use `_FILE` first. */
export const readApiEnv = (env: EnvSource): ApiEnv => ({
    server: parseServerConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    database: parsePrimaryDatabaseConfig(env),
    supabase: parseSupabaseConfig(env),
})
