import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CART_ERROR_KINDS, CartModule, cartEntities, cartMigrations } from "@modules/domain/cart"
import { CatalogModule, catalogEntities, catalogMigrations } from "@modules/domain/catalog"
import { ORDER_ERROR_KINDS, ORDER_MESSAGES, OrderModule, orderEntities, orderMigrations } from "@modules/domain/order"
import { PaymentModule, paymentEntities, paymentMigrations } from "@modules/domain/payment"
import {
    RECEIPT_STORAGE_ERROR_KINDS,
    RECEIPT_STORAGE_MESSAGES,
    ReceiptStorageModule,
} from "@modules/integrations/receipt-storage"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DatabaseModule } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import { I18nModule } from "@modules/platform/i18n"
import { LoggingModule } from "@modules/platform/logging"
import { MESSAGING_ERROR_KINDS, MESSAGING_MESSAGES, MessagingModule } from "@modules/integrations/messaging"
import { CancellationMessageModule } from "@features/cancellation"
import type { OrderWorkerAppOptions } from "./order-worker.options"

@Module({})
/** The composition root of the order worker: the order capabilities of the order api over the same database, the messaging capability and the message transport of the cancellation feature. */
export class AppModule {
    /** Builds the order worker from its parsed options. */
    static register(options: OrderWorkerAppOptions): DynamicModule {
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
                        MESSAGING_MESSAGES,
                        ORDER_MESSAGES,
                        RECEIPT_STORAGE_MESSAGES,
                    ],
                }),
                ErrorsModule.register({
                    isGlobal: true,
                    kinds: [
                        CONFIG_ERROR_KINDS,
                        DATABASE_ERROR_KINDS,
                        HTTP_ERROR_KINDS,
                        MESSAGING_ERROR_KINDS,
                        CART_ERROR_KINDS,
                        ORDER_ERROR_KINDS,
                        RECEIPT_STORAGE_ERROR_KINDS,
                    ],
                }),
                CqrsModule.register({ isGlobal: true }),
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
                MessagingModule.register({ isGlobal: true, ...options.messaging }),
                ReceiptStorageModule.register({ isGlobal: true, ...options.receiptStorage }),
                CatalogModule.register({ isGlobal: true }),
                CartModule.register({ isGlobal: true }),
                PaymentModule.register({ isGlobal: true }),
                OrderModule.register({ isGlobal: true }),
                CancellationMessageModule,
            ],
        }
    }
}
