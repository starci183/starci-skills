import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { AuthGuard, CredentialGuard } from "@modules/domain/identity"
import { ErrorsFilter } from "@modules/platform/errors"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { apiModules } from "./compose/api"
import { backgroundModules } from "./compose/background"
import { databaseModules } from "./compose/database"
import { domainModules } from "./compose/domain"
import { platformModules } from "./compose/platform"
import type { OrderAppOptions } from "./order.options"

@Module({})
/** The order api spreads its typed composition groups, binds its one error filter, and runs the four guards in a fixed order. */
export class AppModule {
    /** Builds the order api from its parsed options. */
    static register(options: OrderAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ...platformModules(options),
                ...backgroundModules(options),
                ...databaseModules(options),
                ...domainModules(options),
                ...apiModules(),
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
