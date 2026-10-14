import type { EnvSource } from "@modules/platform/config"
import { parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig, parseWebhookProviderConfig } from "@modules/platform/http-security"
import { parseJobsConfig } from "@modules/platform/jobs"
import { parseQueueConfig } from "@modules/platform/queue"
import { parseSupabaseConfig } from "@modules/integrations/supabase"
import type { ApiOptions } from "./api.options"

/** The API environment values parsed before app composition. */
export interface ApiEnv extends ApiOptions {}

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
