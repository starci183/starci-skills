import { parseCacheConfig } from "@modules/integrations/cache"
import { parseKeycloakConfig } from "@modules/integrations/keycloak"
import { parseKeycloakAdminConfig } from "@modules/integrations/keycloak-admin"
import { parseOrderApiConfig } from "@modules/integrations/order-api"
import type { EnvSource } from "@modules/platform/config"
import { parseIdentityDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import type { IdentityAppOptions } from "./identity.options"

/** The identity environment values parsed before app composition. */
export interface IdentityEnv extends IdentityAppOptions {}

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
