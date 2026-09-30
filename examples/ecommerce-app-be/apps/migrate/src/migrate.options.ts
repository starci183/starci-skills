import { accountEntities, accountMigrations } from "@modules/domain/account"
import { cartEntities, cartMigrations } from "@modules/domain/cart"
import { catalogEntities, catalogMigrations } from "@modules/domain/catalog"
import { orderEntities, orderMigrations } from "@modules/domain/order"
import { paymentEntities, paymentMigrations } from "@modules/domain/payment"
import type { EnvSource } from "@modules/platform/config"
import { parseIdentityDatabaseConfig, parseOrderDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"

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
            entities: [...catalogEntities, ...cartEntities, ...orderEntities, ...paymentEntities],
            migrations: [...catalogMigrations, ...cartMigrations, ...orderMigrations, ...paymentMigrations],
        },
    ],
})
