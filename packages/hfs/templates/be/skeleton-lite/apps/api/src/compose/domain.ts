import type { DynamicModule, Type } from "@nestjs/common"
import { IdentityModule } from "@modules/domain/identity"
import { LivenessModule } from "@modules/domain/liveness"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"

/** The domain capabilities of the API, with the app's verified Supabase identity adapter. */
export const domainModules = (verifyAccessToken: VerifySupabaseAccessToken): Array<Type<unknown> | DynamicModule> => [
    IdentityModule.register({ isGlobal: true, verifyAccessToken }),
    LivenessModule.register({ isGlobal: true }),
]
