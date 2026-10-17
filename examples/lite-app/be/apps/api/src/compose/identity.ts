import type { DynamicModule, Provider } from "@nestjs/common"
import { IdentityModule } from "@modules/domain/identity"
import {
    SUPABASE_ADMIN_CLIENT,
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    createSupabaseAdminClient,
} from "@modules/integrations/supabase"
import type { SupabaseOptions, VerifySupabaseAccessToken } from "@modules/integrations/supabase"

/** Registers the app-wide identity capability with its token verifier. */
export const identityModules = (verifyAccessToken: VerifySupabaseAccessToken): Array<DynamicModule> => [
    IdentityModule.register({ isGlobal: true, verifyAccessToken }),
]

/** Supplies the app's privileged Supabase infrastructure ports. */
export const identityProviders = (
    options: SupabaseOptions,
    verifyAccessToken: VerifySupabaseAccessToken,
): Array<Provider> => [
    { provide: SUPABASE_ADMIN_CLIENT, useValue: createSupabaseAdminClient(options) },
    { provide: SUPABASE_ACCESS_TOKEN_VERIFIER, useValue: verifyAccessToken },
]
