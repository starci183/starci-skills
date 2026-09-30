import type { EnvSource } from "@modules/platform/config"
import type { DatabaseConnectionConfig } from "./database.options"
import { ORDER_CONNECTION } from "./order.connection"

/** Reads the order connection from the `ORDER_DB_*` keys. */
export const parseOrderDatabaseConfig = (env: EnvSource): DatabaseConnectionConfig => ({
    name: ORDER_CONNECTION,
    url: env.secret("ORDER_DB_URL"),
})
