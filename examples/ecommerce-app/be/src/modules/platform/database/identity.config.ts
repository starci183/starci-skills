import type { EnvSource } from "@modules/platform/config"
import type { DatabaseConnectionConfig } from "./database.options"
import { IDENTITY_CONNECTION } from "./identity.connection"

/** Reads the identity connection from the `IDENTITY_DB_*` keys. */
export const parseIdentityDatabaseConfig = (env: EnvSource): DatabaseConnectionConfig => ({
    name: IDENTITY_CONNECTION,
    url: env.secret("IDENTITY_DB_URL"),
})
