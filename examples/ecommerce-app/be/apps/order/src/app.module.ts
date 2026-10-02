import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, AuthGuard, IdentityModule } from "@modules/domain/identity"
import { CART_ERROR_KINDS, CartModule, cartEntities, cartMigrations } from "@modules/domain/cart"
import { CatalogModule, catalogEntities, catalogMigrations } from "@modules/domain/catalog"
import { ORDER_ERROR_KINDS, ORDER_MESSAGES, OrderModule, orderEntities, orderMigrations } from "@modules/domain/order"
import { LoyaltyModule, loyaltyEntities, loyaltyMigrations } from "@modules/domain/loyalty"
import {
    IDENTITY_API,
    IDENTITY_API_ERROR_KINDS,
    IDENTITY_API_MESSAGES,
    IdentityApiModule,
} from "@modules/integrations/identity-api"
import {
    RECEIPT_STORAGE_ERROR_KINDS,
    RECEIPT_STORAGE_MESSAGES,
    ReceiptStorageModule,
} from "@modules/integrations/receipt-storage"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DatabaseModule, DatabaseProbe, ORDER_ENTITY_MANAGER } from "@modules/platform/database"
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
import { InboxModule, inboxEntities, inboxMigrations } from "@modules/platform/inbox"
import {
    EVENT_BUS_ERROR_KINDS,
    EVENT_BUS_MESSAGES,
    EVENT_TRANSPORT,
    EventBusModule,
    eventBusEntities,
    eventBusMigrations,
} from "@modules/platform/event-bus"
import { JOBS_ERROR_KINDS, JOBS_MESSAGES, JobsModule, jobsEntities, jobsMigrations } from "@modules/platform/jobs"
import { LoggingModule } from "@modules/platform/logging"
import { PROBES_ERROR_KINDS, PROBES_MESSAGES, ProbesModule } from "@modules/platform/probes"
import { QueueModule, queueEntities, queueMigrations } from "@modules/platform/queue"
import { RealtimeModule } from "@modules/platform/realtime"
import { SagaModule, sagaEntities, sagaMigrations } from "@modules/platform/saga"
import { CheckoutGraphqlModule, CheckoutMessageModule } from "@features/checkout"
import { HealthHttpModule } from "@features/health"
import { OrderSummaryModule, orderSummaryEntities, orderSummaryMigrations } from "@modules/projections/order-summary"
import { ExpireOrdersQueueModule } from "@features/jobs/expire-orders"
import { orderExpirySchedulerOf } from "@modules/queues/order-expiry"
import { SendReceiptQueueModule } from "@features/jobs/send-receipt"
import { OrderPaidLoyaltyMessageModule } from "@features/reactors/order-paid-loyalty"
import { OrderPaymentStatusMessageModule } from "@features/reactors/order-payment-status"
import { OrderStatusPushMessageModule } from "@features/reactors/order-status-push"
import { OrderSummaryProjectionMessageModule } from "@features/reactors/order-summary-projection"
import { OrderStatusGraphqlModule } from "@features/realtime/order-status"
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
                        RECEIPT_STORAGE_MESSAGES,
                        EVENT_BUS_MESSAGES,
                        JOBS_MESSAGES,
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
                        RECEIPT_STORAGE_ERROR_KINDS,
                        EVENT_BUS_ERROR_KINDS,
                        JOBS_ERROR_KINDS,
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
                HttpModule.register({ isGlobal: true }),
                IdentityApiModule.register({ isGlobal: true, ...options.identityApi }),
                ReceiptStorageModule.register({ isGlobal: true, ...options.receiptStorage }),
                EventBusModule.register({ isGlobal: true, ...options.eventBus, connections: [ORDER_ENTITY_MANAGER] }),
                CatalogModule.register({ isGlobal: true }),
                CartModule.register({ isGlobal: true }),
                InboxModule.register({ isGlobal: true }),
                RealtimeModule.register({ isGlobal: true }),
                LoyaltyModule.register({ isGlobal: true }),
                OrderSummaryModule,
                SagaModule.register({ isGlobal: true }),
                QueueModule.register({
                    isGlobal: true,
                    ...options.queue,
                    connections: [ORDER_ENTITY_MANAGER],
                    schedulers: [orderExpirySchedulerOf(options.orderExpiry)],
                }),
                JobsModule.register({ isGlobal: true, ...options.jobs, connection: ORDER_ENTITY_MANAGER }),
                OrderModule.register({ isGlobal: true }),
                IdentityModule.register({ isGlobal: true, verifier: IDENTITY_API }),
                ProbesModule.register({
                    isGlobal: true,
                    service: "order",
                    probes: [DatabaseProbe, IDENTITY_API, EVENT_TRANSPORT],
                }),
                GraphqlModule.register({ isGlobal: true }),
                HealthHttpModule,
                CheckoutGraphqlModule,
                CheckoutMessageModule,
                OrderPaymentStatusMessageModule,
                OrderPaidLoyaltyMessageModule,
                OrderStatusPushMessageModule,
                OrderSummaryProjectionMessageModule,
                OrderStatusGraphqlModule,
                ExpireOrdersQueueModule,
                SendReceiptQueueModule,
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
