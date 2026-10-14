import type { Provider } from "@nestjs/common"
import {
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    SUPABASE_ADMIN_CLIENT,
    createSupabaseAdminClient,
} from "@modules/integrations/supabase"
import type { SupabaseOptions, VerifySupabaseAccessToken } from "@modules/integrations/supabase"

/** The Supabase integration ports bound once for this app. */
export const integrationProviders = (
    options: SupabaseOptions,
    verifyAccessToken: VerifySupabaseAccessToken,
): Array<Provider> => [
    { provide: SUPABASE_ADMIN_CLIENT, useValue: createSupabaseAdminClient(options) },
    { provide: SUPABASE_ACCESS_TOKEN_VERIFIER, useValue: verifyAccessToken },
]
