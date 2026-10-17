import { Secret } from "@modules/platform/config"
import { PRIMARY_DATA_SOURCE } from "@modules/platform/database"
import { ACCESS_TOKEN_VERIFIER } from "@modules/domain/identity"
import { SUPABASE_ACCESS_TOKEN_VERIFIER, SUPABASE_ADMIN_CLIENT } from "@modules/integrations/supabase"
import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset"
import { GetToolStatusQuery, StatusController } from "@features/api/tool-status"

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
            name: "primary",
            provider: "supabase",
            url: new Secret("postgresql://app_be@127.0.0.1:5432/postgres"),
            schema: "public",
        },
        supabase: { url: "https://fixture.supabase.co", serviceRoleKey: new Secret("fixture-only") },
    },
    overrides: [
        { token: PRIMARY_DATA_SOURCE, value: { manager: {} } },
        { token: SUPABASE_ADMIN_CLIENT, value: { auth: {}, storage: {} } },
        { token: SUPABASE_ACCESS_TOKEN_VERIFIER, value: () => ({ ok: false }) },
        { token: ACCESS_TOKEN_VERIFIER, value: () => ({ ok: false }) },
    ],
})

/** Arranges the status transport collaborator and its expected typed query. */
export const buildToolStatusProof = () => {
    const queryBus = mock<QueryBus>()
    return {
        queryBus,
        controller: new StatusController(queryBus),
        query: (id: string) => new GetToolStatusQuery({ request: { id } }),
    }
}
