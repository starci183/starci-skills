import type { EnvSource } from "@modules/platform/config"
import type { DatabaseConnectionConfig } from "./database.options"
import { PRIMARY_CONNECTION } from "./primary.connection"

/** Reads the primary connection from the `PRIMARY_DB_*` keys. */
export const parsePrimaryDatabaseConfig = (env: EnvSource): DatabaseConnectionConfig => ({
    name: PRIMARY_CONNECTION,
    url: env.secret("PRIMARY_DB_URL"),
})
