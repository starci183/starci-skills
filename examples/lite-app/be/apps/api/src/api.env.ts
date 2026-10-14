import type { EnvSource } from "@modules/platform/config"
import { parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig, parseWebhookProviderConfig } from "@modules/platform/http-security"
import { parseJobsConfig } from "@modules/platform/jobs"
import { parseQueueConfig } from "@modules/platform/queue"
import { parseSupabaseConfig } from "@modules/integrations/supabase"

/** The API environment values parsed before app composition. */
export interface ApiEnv {
    /** The HTTP listener. */
    readonly server: ReturnType<typeof parseServerConfig>
    /** The origin allowlist, rate limits and signed-webhook configuration. */
    readonly httpSecurity: ReturnType<typeof parseHttpSecurityConfig>
    /** The least-privilege PostgreSQL connection to the Supabase project. */
    readonly database: ReturnType<typeof parsePrimaryDatabaseConfig>
    /** Supabase Auth, Storage and token-verification configuration. */
    readonly supabase: ReturnType<typeof parseSupabaseConfig>
    /** How the queue relay and the pgmq workers run. */
    readonly queue: ReturnType<typeof parseQueueConfig>
    /** Who this worker is and how long a job claim lasts. */
    readonly jobs: ReturnType<typeof parseJobsConfig>
}

/** Reads the API environment; missing or invalid values fail boot and secret readers prefer mounted files. */
export const readApiEnv = (env: EnvSource): ApiEnv => ({
    server: parseServerConfig(env),
    httpSecurity: {
        ...parseHttpSecurityConfig(env),
        webhooks: {
            calendar: parseWebhookProviderConfig(env, "CALENDAR"),
        },
    },
    database: parsePrimaryDatabaseConfig(env),
    supabase: parseSupabaseConfig(env),
    queue: parseQueueConfig(env),
    jobs: parseJobsConfig(env),
})
