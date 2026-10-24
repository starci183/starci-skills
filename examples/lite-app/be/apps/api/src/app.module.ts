import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { ErrorsFilter } from "@modules/platform/errors"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { createSupabaseAccessTokenVerifier } from "@modules/integrations/supabase"
import { AuthGuard, CredentialGuard } from "@modules/domain/identity"
import type { ApiOptions } from "./api.options"
import { bookingsModules } from "./compose/bookings"
import { platformModules } from "./compose/platform"
import { realtimeModules } from "./compose/realtime"
import { identityModules, identityProviders } from "./compose/identity"
import { healthModules } from "./compose/health"

@Module({})
/** Composition root of the API: it spreads the composition groups of `compose/`, and the four guards run in a fixed order. */
export class AppModule {
    /** Builds the module from options parsed once at boot; nothing here reads the environment. */
    static register(options: ApiOptions): DynamicModule {
        const verifyAccessToken = createSupabaseAccessTokenVerifier(options.supabase)
        return {
            module: AppModule,
            imports: [
                ...platformModules(options),
                ...bookingsModules(),
                ...realtimeModules(),
                ...identityModules(verifyAccessToken),
                ...healthModules(),
            ],
            providers: [
                ...identityProviders(options.supabase, verifyAccessToken),
                { provide: APP_FILTER, useClass: ErrorsFilter },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_GUARD, useClass: OriginGuard },
                { provide: APP_GUARD, useClass: CredentialGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }
    }
}
