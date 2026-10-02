import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import {
    INVOICE_ERROR_KINDS,
    INVOICE_MESSAGES,
    InvoiceModule,
    invoiceEntities,
    invoiceMigrations,
} from "@modules/domain/invoice"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DatabaseModule } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { I18nModule } from "@modules/platform/i18n"
import { EVENT_BUS_ERROR_KINDS, EVENT_BUS_MESSAGES, EventBusModule } from "@modules/platform/event-bus"
import { InboxModule, inboxEntities, inboxMigrations } from "@modules/platform/inbox"
import { LoggingModule } from "@modules/platform/logging"
import { MESSAGING_ERROR_KINDS, MESSAGING_MESSAGES, MessagingModule } from "@modules/platform/messaging"
import { InvoicingMessageModule } from "@features/invoicing"
import type { BillingAppOptions } from "./billing.options"

@Module({})
/** The composition root of the billing worker: the capabilities the invoice handler needs, the messaging capability and the message transport of the invoicing feature. */
export class AppModule {
    /** Builds the billing worker from its parsed options. */
    static register(options: BillingAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ClockModule.register({ isGlobal: true }),
                LoggingModule.register({ isGlobal: true }),
                I18nModule.register({
                    isGlobal: true,
                    bundles: [ERRORS_MESSAGES, MESSAGING_MESSAGES, EVENT_BUS_MESSAGES, INVOICE_MESSAGES],
                }),
                ErrorsModule.register({
                    isGlobal: true,
                    kinds: [
                        CONFIG_ERROR_KINDS,
                        DATABASE_ERROR_KINDS,
                        MESSAGING_ERROR_KINDS,
                        EVENT_BUS_ERROR_KINDS,
                        INVOICE_ERROR_KINDS,
                    ],
                }),
                CqrsModule.register({ isGlobal: true }),
                DatabaseModule.register({
                    isGlobal: true,
                    connections: [
                        {
                            ...options.database,
                            entities: [...invoiceEntities, ...inboxEntities],
                            migrations: [...invoiceMigrations, ...inboxMigrations],
                        },
                    ],
                }),
                InboxModule.register({ isGlobal: true }),
                MessagingModule.register({ isGlobal: true, ...options.messaging }),
                EventBusModule.register({ isGlobal: true }),
                InvoiceModule.register({ isGlobal: true, ...options.invoice }),
                InvoicingMessageModule,
            ],
        }
    }
}
