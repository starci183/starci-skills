import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { AuthGuard, IdentityModule } from "@modules/domain/identity"
import { CartModule, cartEntities, cartMigrations } from "@modules/domain/cart"
import { CatalogModule, catalogEntities, catalogMigrations } from "@modules/domain/catalog"
import { OrderModule, orderEntities, orderMigrations } from "@modules/domain/order"
import { LoyaltyModule, loyaltyEntities, loyaltyMigrations } from "@modules/domain/loyalty"
import { IDENTITY_API, IdentityApiModule } from "@modules/integrations/identity-api"
import { ReceiptStorageModule } from "@modules/integrations/receipt-storage"
import { ORDER_CONNECTION, DatabaseModule } from "@modules/platform/database"
import { ErrorsFilter } from "@modules/platform/errors"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { inboxEntities, inboxMigrations } from "@modules/platform/inbox"
import { eventBusEntities, eventBusMigrations } from "@modules/platform/event-bus"
import { jobsEntities, jobsMigrations } from "@modules/platform/jobs"
import { queueEntities, queueMigrations } from "@modules/platform/queue"
import { sagaEntities, sagaMigrations } from "@modules/platform/saga"
import { CheckoutGraphqlModule } from "@features/api/checkout"
import { HealthHttpModule } from "@features/api/health"
import { OrderSummaryModule, orderSummaryEntities, orderSummaryMigrations } from "@modules/projections/order-summary"
import { OrderStatusGraphqlModule } from "@features/realtime/order-status"
import { backgroundModules } from "./compose/background"
import { platformModules } from "./compose/platform"
import type { OrderAppOptions } from "./order.options"

@Module({})
/** The composition root of the order api: it spreads the composition groups of `compose/`, registers the order connection and the domain capabilities once, binds its one error filter, and the three guards run in a fixed order. */
export class AppModule {
    /** Builds the order api from its parsed options. */
    static register(options: OrderAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ...platformModules(options),
                ...backgroundModules(options),
                DatabaseModule.register({
                    isGlobal: true,
                    connections: [
                        {
                            ...options.database,
                            name: ORDER_CONNECTION,
                            entities: [
                                ...catalogEntities,
                                ...cartEntities,
                                ...orderEntities,
                                ...loyaltyEntities,
                                ...orderSummaryEntities,
                                ...inboxEntities,
                                ...sagaEntities,
                                ...eventBusEntities,
                                ...queueEntities,
                                ...jobsEntities,
                            ],
                            migrations: [
                                ...catalogMigrations,
                                ...cartMigrations,
                                ...orderMigrations,
                                ...loyaltyMigrations,
                                ...orderSummaryMigrations,
                                ...inboxMigrations,
                                ...sagaMigrations,
                                ...eventBusMigrations,
                                ...queueMigrations,
                                ...jobsMigrations,
                            ],
                        },
                    ],
                }),
                IdentityApiModule.register({ isGlobal: true, ...options.identityApi }),
                ReceiptStorageModule.register({ isGlobal: true, ...options.receiptStorage }),
                CatalogModule.register({ isGlobal: true }),
                CartModule.register({ isGlobal: true }),
                LoyaltyModule.register({ isGlobal: true }),
                OrderSummaryModule.register({ isGlobal: true }),
                OrderModule.register({ isGlobal: true }),
                IdentityModule.register({ isGlobal: true, verifier: IDENTITY_API }),
                HealthHttpModule,
                CheckoutGraphqlModule,
                OrderStatusGraphqlModule,
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
