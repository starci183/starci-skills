import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { SystemHealthHttpModule } from "@features/api/system-health"
import { AuthGuard, IdentityModule } from "@modules/domain/identity"
import {
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    SUPABASE_ADMIN_CLIENT,
    createSupabaseAccessTokenVerifier,
    createSupabaseAdminClient,
} from "@modules/integrations/supabase"
import { LivenessModule } from "@modules/domain/liveness"
import { ErrorsFilter } from "@modules/platform/errors"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { platformModules } from "./compose/platform"
import type { ApiOptions } from "./api.options"

@Module({})
/** Composition root of the API: it spreads the composition groups of `compose/`, and the three guards run in a fixed order. */
export class AppModule {
    /** Builds the module from options parsed once at boot; nothing here reads the environment. */
    static register(options: ApiOptions): DynamicModule {
        const verifyAccessToken = createSupabaseAccessTokenVerifier(options.supabase)
        return {
            module: AppModule,
            imports: [
                ...platformModules(options),
                IdentityModule.register({ isGlobal: true, verifyAccessToken }),
                LivenessModule.register({ isGlobal: true }),
                SystemHealthHttpModule,
            ],
            providers: [
                {
                    provide: SUPABASE_ADMIN_CLIENT,
                    useValue: createSupabaseAdminClient(options.supabase),
                },
                { provide: SUPABASE_ACCESS_TOKEN_VERIFIER, useValue: verifyAccessToken },
                { provide: APP_FILTER, useClass: ErrorsFilter },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_GUARD, useClass: OriginGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }
    }
}
