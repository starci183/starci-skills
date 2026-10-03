import type { EnvSource } from "@modules/platform/config"
import type { SupabaseOptions } from "./supabase.options"

/** Reads Supabase configuration with no credential or localhost defaults. */
export const parseSupabaseConfig = (env: EnvSource): SupabaseOptions => ({
    url: env.url("SUPABASE_URL"),
    serviceRoleKey: env.secret("SUPABASE_SERVICE_ROLE_KEY"),
})
