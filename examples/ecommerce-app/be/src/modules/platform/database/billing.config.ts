import type { EnvSource } from "@modules/platform/config"
import type { DatabaseConnectionConfig } from "./database.options"
import { BILLING_CONNECTION } from "./billing.connection"

/** Reads the billing connection from the `BILLING_DB_*` keys. */
export const parseBillingDatabaseConfig = (env: EnvSource): DatabaseConnectionConfig => ({
    name: BILLING_CONNECTION,
    url: env.secret("BILLING_DB_URL"),
})
