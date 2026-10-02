import { accountEntities, accountMigrations } from "@modules/domain/account"
import { cartEntities, cartMigrations } from "@modules/domain/cart"
import { catalogEntities, catalogMigrations } from "@modules/domain/catalog"
import { orderEntities, orderMigrations } from "@modules/domain/order"
import { paymentEntities, paymentMigrations } from "@modules/domain/payment"
import type { EnvSource } from "@modules/platform/config"
import { parseIdentityDatabaseConfig, parseOrderDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"

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

/** The order database: the catalog, the carts, the orders and their payments. */
export const orderConnectionOf = (env: EnvSource): DatabaseConnectionOptions => ({
    ...parseOrderDatabaseConfig(env),
    entities: [...catalogEntities, ...cartEntities, ...orderEntities, ...paymentEntities],
    migrations: [...catalogMigrations, ...cartMigrations, ...orderMigrations, ...paymentMigrations],
})

/** Parses the cli options from the environment: one entry per connection, each built by its own function above. */
export const parseCliAppOptions = (env: EnvSource): CliAppOptions => ({
    connections: [identityConnectionOf(env), orderConnectionOf(env)],
})
