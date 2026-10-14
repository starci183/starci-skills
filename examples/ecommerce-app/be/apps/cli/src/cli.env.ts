import type { EnvSource } from "@modules/platform/config"
import {
    parseBillingDatabaseConfig,
    parseIdentityDatabaseConfig,
    parseOrderDatabaseConfig,
} from "@modules/platform/database"
import type { DatabaseConnectionConfig } from "@modules/platform/database"

/** The cli's database configurations before entities and migrations are bound. */
export interface CliEnv {
    /** The identity database configuration. */
    readonly identity: DatabaseConnectionConfig
    /** The order database configuration. */
    readonly order: DatabaseConnectionConfig
    /** The billing database configuration. */
    readonly billing: DatabaseConnectionConfig
}

/** Reads every cli connection with no defaults; database secret readers prefer mounted files. */
export const readCliEnv = (env: EnvSource): CliEnv => ({
    identity: parseIdentityDatabaseConfig(env),
    order: parseOrderDatabaseConfig(env),
    billing: parseBillingDatabaseConfig(env),
})
