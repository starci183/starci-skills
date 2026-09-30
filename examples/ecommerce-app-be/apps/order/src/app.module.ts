import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, AuthGuard, IdentityModule } from "@modules/domain/identity"
import { CART_ERROR_KINDS, CartModule, cartEntities, cartMigrations } from "@modules/domain/cart"
import { CatalogModule, catalogEntities, catalogMigrations } from "@modules/domain/catalog"
import { ORDER_ERROR_KINDS, ORDER_MESSAGES, OrderModule, orderEntities, orderMigrations } from "@modules/domain/order"
import { PaymentModule, paymentEntities, paymentMigrations } from "@modules/domain/payment"
import {
    IDENTITY_API,
    IDENTITY_API_ERROR_KINDS,
    IDENTITY_API_MESSAGES,
    IdentityApiModule,
} from "@modules/integrations/identity-api"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DatabaseModule, DatabaseProbeService } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsFilter, ErrorsModule } from "@modules/platform/errors"
import { GraphqlModule } from "@modules/platform/graphql"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import {
    HTTP_SECURITY_ERROR_KINDS,
    HTTP_SECURITY_MESSAGES,
    HttpSecurityModule,
    OriginGuard,
    RateLimitGuard,
} from "@modules/platform/http-security"
import { I18nModule } from "@modules/platform/i18n"
import { LoggingModule } from "@modules/platform/logging"
import { PROBES_ERROR_KINDS, PROBES_MESSAGES, ProbesModule } from "@modules/platform/probes"
import { CheckoutGraphqlModule } from "@features/checkout"
import { HealthHttpModule } from "@features/health"
import type { OrderAppOptions } from "./order.options"

@Module({})
/** The composition root of the order api: every capability is registered once, app-wide, its one error filter is bound, and the three guards run in a fixed order. */
export class AppModule {
    /** Builds the order api from its parsed options. */
    static register(options: OrderAppOptions): DynamicModule {
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
                        IDENTITY_API_MESSAGES,
                        ORDER_MESSAGES,
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
                        IDENTITY_API_ERROR_KINDS,
                        CART_ERROR_KINDS,
                        ORDER_ERROR_KINDS,
                        IDENTITY_ERROR_KINDS,
                    ],
                }),
                CqrsModule.register({ isGlobal: true }),
                HttpSecurityModule.register({ isGlobal: true, ...options.httpSecurity }),
                DatabaseModule.register({
                    isGlobal: true,
                    connections: [
                        {
                            ...options.database,
                            entities: [...catalogEntities, ...cartEntities, ...orderEntities, ...paymentEntities],
                            migrations: [
                                ...catalogMigrations,
                                ...cartMigrations,
                                ...orderMigrations,
                                ...paymentMigrations,
                            ],
                        },
                    ],
                }),
                HttpModule.register({ isGlobal: true }),
                IdentityApiModule.register({ isGlobal: true, ...options.identityApi }),
                CatalogModule.register({ isGlobal: true }),
                CartModule.register({ isGlobal: true }),
                PaymentModule.register({ isGlobal: true }),
                OrderModule.register({ isGlobal: true }),
                IdentityModule.register({ isGlobal: true, verifier: IDENTITY_API }),
                ProbesModule.register({
                    isGlobal: true,
                    service: "order",
                    probes: [DatabaseProbeService, IDENTITY_API],
                }),
                GraphqlModule.register({ isGlobal: true }),
                HealthHttpModule,
                CheckoutGraphqlModule,
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
