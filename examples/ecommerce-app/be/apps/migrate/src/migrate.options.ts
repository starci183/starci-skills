import { accountEntities, accountMigrations } from "@modules/domain/account"
import { cartEntities, cartMigrations } from "@modules/domain/cart"
import { catalogEntities, catalogMigrations } from "@modules/domain/catalog"
import { invoiceEntities, invoiceMigrations } from "@modules/domain/invoice"
import { loyaltyEntities, loyaltyMigrations } from "@modules/domain/loyalty"
import { orderEntities, orderMigrations } from "@modules/domain/order"
import { paymentEntities, paymentMigrations } from "@modules/domain/payment"
import type { EnvSource } from "@modules/platform/config"
import {
    parseBillingDatabaseConfig,
    parseIdentityDatabaseConfig,
    parseOrderDatabaseConfig,
} from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import { eventBusEntities, eventBusMigrations } from "@modules/platform/event-bus"
import { inboxEntities, inboxMigrations } from "@modules/platform/inbox"
import { orderSummaryEntities, orderSummaryMigrations } from "@modules/projections/order-summary"
import { sagaEntities, sagaMigrations } from "@modules/platform/saga"

/** Everything the migrate app needs from its environment: every connection with the entities and migrations of its owners. */
export interface MigrateAppOptions {
    /** The connections to migrate, in the order they run. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}

/** Parses the migrate options from the environment. */
export const parseMigrateAppOptions = (env: EnvSource): MigrateAppOptions => ({
    connections: [
        { ...parseIdentityDatabaseConfig(env), entities: accountEntities, migrations: accountMigrations },
        {
            ...parseOrderDatabaseConfig(env),
            entities: [
                ...catalogEntities,
                ...cartEntities,
                ...orderEntities,
                ...loyaltyEntities,
                ...orderSummaryEntities,
                ...inboxEntities,
                ...sagaEntities,
                ...eventBusEntities,
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
            ],
        },
        {
            ...parseBillingDatabaseConfig(env),
            entities: [...invoiceEntities, ...paymentEntities, ...inboxEntities, ...eventBusEntities],
            migrations: [...invoiceMigrations, ...paymentMigrations, ...inboxMigrations, ...eventBusMigrations],
        },
    ],
})
