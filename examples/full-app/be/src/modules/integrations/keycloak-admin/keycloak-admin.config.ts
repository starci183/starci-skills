import type { EnvSource } from "@modules/platform/config"
import type { KeycloakAdminOptions } from "./keycloak-admin.options"

/** Reads the keycloak admin options: URL, realm, client and its secret are required, the timeout is a tunable with a literal default. */
export const parseKeycloakAdminConfig = (env: EnvSource): KeycloakAdminOptions => ({
    url: env.url("KEYCLOAK_ADMIN_URL"),
    realm: env.string("KEYCLOAK_ADMIN_REALM"),
    clientId: env.string("KEYCLOAK_ADMIN_CLIENT_ID"),
    clientSecret: env.secret("KEYCLOAK_ADMIN_CLIENT_SECRET"),
    timeoutMs: env.duration("KEYCLOAK_ADMIN_TIMEOUT", 3000),
})
