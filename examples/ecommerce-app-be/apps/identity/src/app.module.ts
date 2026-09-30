import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { ACCOUNT_ERROR_KINDS, ACCOUNT_MESSAGES, AccountModule, accountEntities, accountMigrations } from "@modules/domain/account"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, AuthGuard, IdentityModule } from "@modules/domain/identity"
import { SESSION_ERROR_KINDS, SESSION_MESSAGES, SessionModule, SessionService } from "@modules/domain/session"
import { CACHE, CACHE_ERROR_KINDS, CACHE_MESSAGES, CacheModule } from "@modules/integrations/cache"
import { ORDER_API_ERROR_KINDS, ORDER_API_MESSAGES, OrderApiModule } from "@modules/integrations/order-api"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DatabaseModule, DatabaseProbe } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsFilter, ErrorsModule } from "@modules/platform/errors"
import { GraphqlModule } from "@modules/platform/graphql"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import { HTTP_SECURITY_ERROR_KINDS, HTTP_SECURITY_MESSAGES, HttpSecurityModule, OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { I18nModule } from "@modules/platform/i18n"
import { LoggingModule } from "@modules/platform/logging"
import { PROBES_ERROR_KINDS, PROBES_MESSAGES, ProbesModule } from "@modules/platform/probes"
import { HealthHttpModule } from "@features/health"
import { IdentityGraphqlModule } from "@features/identity"
import type { IdentityAppOptions } from "./identity.options"

@Module({})
/** The composition root of the identity api: every capability is registered once, app-wide, its one error filter is bound, and the three guards run in a fixed order. */
export class AppModule {
    /** Builds the identity api from its parsed options. */
    static register(options: IdentityAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ClockModule.register({ isGlobal: true }),
                LoggingModule.register({ isGlobal: true }),
                I18nModule.register({
                    isGlobal: true,
                    bundles: [
                        ERRORS_MESSAGES,
                        HTTP_MESSAGES,
                        HTTP_SECURITY_MESSAGES,
                        PROBES_MESSAGES,
                        CACHE_MESSAGES,
                        ORDER_API_MESSAGES,
                        ACCOUNT_MESSAGES,
                        SESSION_MESSAGES,
                        IDENTITY_MESSAGES,
                    ],
                }),
                ErrorsModule.register({
                    isGlobal: true,
                    kinds: [
                        CONFIG_ERROR_KINDS,
                        DATABASE_ERROR_KINDS,
                        HTTP_ERROR_KINDS,
                        HTTP_SECURITY_ERROR_KINDS,
                        PROBES_ERROR_KINDS,
                        CACHE_ERROR_KINDS,
                        ORDER_API_ERROR_KINDS,
                        ACCOUNT_ERROR_KINDS,
                        SESSION_ERROR_KINDS,
                        IDENTITY_ERROR_KINDS,
                    ],
                }),
                CqrsModule.register({ isGlobal: true }),
                HttpSecurityModule.register({ isGlobal: true, ...options.httpSecurity }),
                DatabaseModule.register({
                    isGlobal: true,
                    connections: [{ ...options.database, entities: accountEntities, migrations: accountMigrations }],
                }),
                CacheModule.register({ isGlobal: true, ...options.cache }),
                HttpModule.register({ isGlobal: true }),
                OrderApiModule.register({ isGlobal: true, ...options.orderApi }),
                AccountModule.register({ isGlobal: true }),
                SessionModule.register({ isGlobal: true }),
                IdentityModule.register({ isGlobal: true, verifier: SessionService }),
                ProbesModule.register({ isGlobal: true, service: "identity", probes: [DatabaseProbe, CACHE] }),
                GraphqlModule.register({ isGlobal: true }),
                HealthHttpModule,
                IdentityGraphqlModule,
            ],
            providers: [
                { provide: APP_FILTER, useClass: ErrorsFilter },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_GUARD, useClass: OriginGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }
    }
}
