import type { EnvSource } from "@modules/platform/config"
import type { KeycloakAdminOptions } from "./keycloak-admin.options"

/** Reads the keycloak admin options: URL, realm and token are required, the timeout is a tunable with a literal default. */
export const parseKeycloakAdminConfig = (env: EnvSource): KeycloakAdminOptions => ({
    url: env.url("KEYCLOAK_ADMIN_URL"),
    realm: env.string("KEYCLOAK_ADMIN_REALM"),
    token: env.secret("KEYCLOAK_ADMIN_TOKEN"),
    timeoutMs: env.duration("KEYCLOAK_ADMIN_TIMEOUT", 3000),
})
