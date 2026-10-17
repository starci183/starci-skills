import type { DynamicModule } from "@nestjs/common"
import { accountEntities, accountMigrations } from "@modules/domain/account"
import { cartEntities, cartMigrations } from "@modules/domain/cart"
import { catalogEntities, catalogMigrations } from "@modules/domain/catalog"
import { invoiceEntities, invoiceMigrations } from "@modules/domain/invoice"
import { loyaltyEntities, loyaltyMigrations } from "@modules/domain/loyalty"
import { orderEntities, orderMigrations } from "@modules/domain/order"
import { paymentEntities, paymentMigrations } from "@modules/domain/payment"
import type { DatabaseConnectionConfig, DatabaseConnectionOptions } from "@modules/platform/database"
import { BILLING_CONNECTION, DatabaseModule, IDENTITY_CONNECTION, ORDER_CONNECTION } from "@modules/platform/database"
import { eventBusEntities, eventBusMigrations } from "@modules/platform/event-bus"
import { inboxEntities, inboxMigrations } from "@modules/platform/inbox"
import { jobsEntities, jobsMigrations } from "@modules/platform/jobs"
import { queueEntities, queueMigrations } from "@modules/platform/queue"
import { sagaEntities, sagaMigrations } from "@modules/platform/saga"
import { orderSummaryEntities, orderSummaryMigrations } from "@modules/projections/order-summary"
import type { CliEnv } from "../cli.env"

/** The identity database: the accounts of the identity service. */
const identityConnectionOf = (identity: DatabaseConnectionConfig): DatabaseConnectionOptions => ({
    ...identity,
    name: IDENTITY_CONNECTION,
    entities: accountEntities,
    migrations: accountMigrations,
})

/** The order database: the catalog, the carts, the orders, loyalty, the order-summary projection and its inbox, the place-order saga, the order outbox, the queue outbox and the job table. */
const orderConnectionOf = (order: DatabaseConnectionConfig): DatabaseConnectionOptions => ({
    ...order,
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
})

/** The billing database: the invoices, the payments, the billing inbox and the billing outbox. */
const billingConnectionOf = (billing: DatabaseConnectionConfig): DatabaseConnectionOptions => ({
    ...billing,
    name: BILLING_CONNECTION,
    entities: [...invoiceEntities, ...paymentEntities, ...inboxEntities, ...eventBusEntities],
    migrations: [...invoiceMigrations, ...paymentMigrations, ...inboxMigrations, ...eventBusMigrations],
})

/** Binds the parsed configurations to each database owner's entities and migrations. */
export const databaseConnections = (databases: CliEnv): Array<DatabaseConnectionOptions> => [
    identityConnectionOf(databases.identity),
    orderConnectionOf(databases.order),
    billingConnectionOf(databases.billing),
]

/** The CLI opens each service connection with its owned entities and migrations. */
export const databaseModules = (options: CliEnv): Array<DynamicModule> => [
    DatabaseModule.register({ isGlobal: true, connections: databaseConnections(options) }),
]
