import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { AuthGuard, CredentialGuard } from "@modules/domain/identity"
import { ErrorsFilter } from "@modules/platform/errors"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { foundationModules } from "./compose/foundation"
import { identityModules } from "./compose/identity"
import { platformModules } from "./compose/platform"
import { transportModules } from "./compose/transport"
import type { IdentityAppOptions } from "./identity.options"

@Module({})
/** The composition root of the identity api: every capability is registered once, app-wide, its one error filter is bound, and the four guards run in a fixed order. */
export class AppModule {
    /** Builds the identity api from its parsed options. */
    static register(options: IdentityAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ...foundationModules(),
                ...platformModules(options),
                ...identityModules(options),
                ...transportModules(),
            ],
            providers: [
                { provide: APP_FILTER, useClass: ErrorsFilter },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_GUARD, useClass: OriginGuard },
                { provide: APP_GUARD, useClass: CredentialGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }
    }
}
