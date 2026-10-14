import { getDataSourceToken } from "@nestjs/typeorm"
import { Secret } from "@modules/platform/config"
import { PRIMARY_CONNECTION } from "@modules/platform/database"
import { ACCESS_TOKEN_VERIFIER } from "@modules/domain/identity"
import {
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    SUPABASE_ADMIN_CLIENT,
} from "@modules/integrations/supabase"

/** Compiles the real API root with public configuration and explicit infrastructure doubles. */
export const buildWiringProof = () => ({
    options: {
        server: { port: 3000 },
        httpSecurity: {
            allowedOrigins: ["https://fixture.example"],
            rateLimit: { windowMs: 60000, defaultLimit: 100, strictLimit: 10 },
            webhooks: {},
        },
        database: {
            name: PRIMARY_CONNECTION,
            provider: "supabase",
            url: new Secret("postgresql://app_be@127.0.0.1:5432/postgres"),
            schema: "public",
        },
        supabase: { url: "https://fixture.supabase.co", serviceRoleKey: new Secret("fixture-only") },
    },
    overrides: [
        { token: getDataSourceToken(PRIMARY_CONNECTION), value: { manager: {} } },
        { token: SUPABASE_ADMIN_CLIENT, value: { auth: {}, storage: {} } },
        { token: SUPABASE_ACCESS_TOKEN_VERIFIER, value: async () => ({ ok: false }) },
        { token: ACCESS_TOKEN_VERIFIER, value: async () => ({ ok: false }) },
    ],
})
