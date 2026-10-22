import { parseCacheConfig } from "@modules/integrations/cache"
import { parseKeycloakConfig } from "@modules/integrations/keycloak"
import { parseKeycloakAdminConfig } from "@modules/integrations/keycloak-admin"
import { parseOrderApiConfig } from "@modules/integrations/order-api"
import type { EnvSource } from "@modules/platform/config"
import { parseIdentityDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"

/** The identity environment values parsed before app composition. */
export interface IdentityEnv {
    /** The port the API listens on. */
    readonly port: number
    /** The identity database connection. */
    readonly database: ReturnType<typeof parseIdentityDatabaseConfig>
    /** The Redis session store. */
    readonly cache: ReturnType<typeof parseCacheConfig>
    /** The realm's password grant shoppers sign in with. */
    readonly keycloak: ReturnType<typeof parseKeycloakConfig>
    /** The Keycloak admin API shoppers are created through. */
    readonly keycloakAdmin: ReturnType<typeof parseKeycloakAdminConfig>
    /** Where the order service answers. */
    readonly orderApi: ReturnType<typeof parseOrderApiConfig>
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: ReturnType<typeof parseHttpSecurityConfig>
}

/** Reads the identity environment; missing or invalid values fail boot and secret readers prefer mounted files. */
export const readIdentityEnv = (env: EnvSource): IdentityEnv => ({
    port: env.int("IDENTITY_API_PORT"),
    database: parseIdentityDatabaseConfig(env),
    cache: parseCacheConfig(env),
    keycloak: parseKeycloakConfig(env),
    keycloakAdmin: parseKeycloakAdminConfig(env),
    orderApi: parseOrderApiConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
})
