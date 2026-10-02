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
import { jobsEntities, jobsMigrations } from "@modules/platform/jobs"
import { queueEntities, queueMigrations } from "@modules/platform/queue"
import { sagaEntities, sagaMigrations } from "@modules/platform/saga"
import { orderSummaryEntities, orderSummaryMigrations } from "@modules/projections/order-summary"

/** Everything the cli app needs from its environment: every connection with the entities and migrations of its owners. */
export interface CliAppOptions {
    /** The connections the migrate command migrates, in the order it runs them. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}

/** The identity database: the accounts of the identity service. */
export const identityConnectionOf = (env: EnvSource): DatabaseConnectionOptions => ({
    ...parseIdentityDatabaseConfig(env),
    entities: accountEntities,
    migrations: accountMigrations,
})

/** The order database: the catalog, the carts, the orders, loyalty, the order-summary projection and its inbox, the place-order saga, the order outbox, the queue outbox and the job table. */
export const orderConnectionOf = (env: EnvSource): DatabaseConnectionOptions => ({
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
})

/** The billing database: the invoices, the payments, the billing inbox and the billing outbox. */
export const billingConnectionOf = (env: EnvSource): DatabaseConnectionOptions => ({
    ...parseBillingDatabaseConfig(env),
    entities: [...invoiceEntities, ...paymentEntities, ...inboxEntities, ...eventBusEntities],
    migrations: [...invoiceMigrations, ...paymentMigrations, ...inboxMigrations, ...eventBusMigrations],
})

/** Parses the cli options from the environment: one entry per connection, each built by its own function above. */
export const parseCliAppOptions = (env: EnvSource): CliAppOptions => ({
    connections: [identityConnectionOf(env), orderConnectionOf(env), billingConnectionOf(env)],
})
