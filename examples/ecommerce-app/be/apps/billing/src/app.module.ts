import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, AuthGuard, IdentityModule } from "@modules/domain/identity"
import {
    INVOICE_ERROR_KINDS,
    INVOICE_MESSAGES,
    InvoiceModule,
    invoiceEntities,
    invoiceMigrations,
} from "@modules/domain/invoice"
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
import { BILLING_ENTITY_MANAGER, DATABASE_ERROR_KINDS, DatabaseModule, DatabaseProbe } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsFilter, ErrorsModule } from "@modules/platform/errors"
import {
    EVENT_BUS_ERROR_KINDS,
    EVENT_BUS_MESSAGES,
    EventBusModule,
    eventBusEntities,
    eventBusMigrations,
} from "@modules/platform/event-bus"
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
import { LoggingModule } from "@modules/platform/logging"
import { PROBES_ERROR_KINDS, PROBES_MESSAGES, ProbesModule } from "@modules/platform/probes"
import { HealthHttpModule } from "@features/api/health"
import { InvoicingMessageModule } from "@features/api/invoicing"
import { SepayHttpModule } from "@features/webhooks/sepay"
import type { BillingAppOptions } from "./billing.options"

@Module({})
/**
 * The composition root of the billing api: the invoice and payment capabilities over the billing database, the consumer of the
 * order events, the signed webhook door of the bank transfer notifier and the readiness probe. It serves no authenticated
 * operation, but the three guards run in the fixed order like in every api, so a door that is not declared open is denied.
 */
export class AppModule {
    /** Builds the billing api from its parsed options. */
    static register(options: BillingAppOptions): DynamicModule {
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
                        IDENTITY_MESSAGES,
                        EVENT_BUS_MESSAGES,
                        INVOICE_MESSAGES,
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
                        IDENTITY_ERROR_KINDS,
                        EVENT_BUS_ERROR_KINDS,
                        INVOICE_ERROR_KINDS,
                    ],
                }),
                CqrsModule.register({ isGlobal: true }),
                HttpSecurityModule.register({ isGlobal: true, ...options.httpSecurity }),
                DatabaseModule.register({
                    isGlobal: true,
                    connections: [
                        {
                            ...options.database,
                            entities: [...invoiceEntities, ...paymentEntities, ...inboxEntities, ...eventBusEntities],
                            migrations: [
                                ...invoiceMigrations,
                                ...paymentMigrations,
                                ...inboxMigrations,
                                ...eventBusMigrations,
                            ],
                        },
                    ],
                }),
                HttpModule.register({ isGlobal: true }),
                IdentityApiModule.register({ isGlobal: true, ...options.identityApi }),
                InboxModule.register({ isGlobal: true, connection: BILLING_ENTITY_MANAGER }),
                EventBusModule.register({ isGlobal: true, ...options.eventBus, connections: [BILLING_ENTITY_MANAGER] }),
                InvoiceModule.register({ isGlobal: true, ...options.invoice }),
                PaymentModule.register({ isGlobal: true }),
                IdentityModule.register({ isGlobal: true, verifier: IDENTITY_API }),
                ProbesModule.register({
                    isGlobal: true,
                    service: "billing",
                    probes: [DatabaseProbe, IDENTITY_API],
                }),
                HealthHttpModule,
                InvoicingMessageModule,
                SepayHttpModule,
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
