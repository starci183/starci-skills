import type { CacheOptions } from "@modules/integrations/cache"
import type { KeycloakOptions } from "@modules/integrations/keycloak"
import type { KeycloakAdminOptions } from "@modules/integrations/keycloak-admin"
import type { OrderApiOptions } from "@modules/integrations/order-api"
import { parseCacheConfig } from "@modules/integrations/cache"
import { parseKeycloakConfig } from "@modules/integrations/keycloak"
import { parseKeycloakAdminConfig } from "@modules/integrations/keycloak-admin"
import { parseOrderApiConfig } from "@modules/integrations/order-api"
import type { EnvSource } from "@modules/platform/config"
import { parseIdentityDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import type { HttpSecurityOptions } from "@modules/platform/http-security"

/** Everything the identity api needs from its environment, parsed once in main.ts. */
export interface IdentityAppOptions {
    /** The port the api listens on. */
    readonly port: number
    /** The identity database connection. */
    readonly database: DatabaseConnectionConfig
    /** The Redis session store. */
    readonly cache: CacheOptions
    /** The realm's password grant shoppers sign in with. */
    readonly keycloak: KeycloakOptions
    /** The Keycloak admin API shoppers are created through. */
    readonly keycloakAdmin: KeycloakAdminOptions
    /** Where the order service answers. */
    readonly orderApi: OrderApiOptions
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: HttpSecurityOptions
}

/** Parses the identity api options from the environment; a missing or malformed key stops the boot naming the key. */
export const parseIdentityAppOptions = (env: EnvSource): IdentityAppOptions => ({
    port: env.int("IDENTITY_API_PORT"),
    database: parseIdentityDatabaseConfig(env),
    cache: parseCacheConfig(env),
    keycloak: parseKeycloakConfig(env),
    keycloakAdmin: parseKeycloakAdminConfig(env),
    orderApi: parseOrderApiConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
})
