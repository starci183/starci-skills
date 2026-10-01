import type { EnvSource } from "@modules/platform/config"
import type { KeycloakOptions } from "./keycloak.options"

/** Reads the keycloak options: the endpoint and the client id are required, the timeout is a tunable with a literal default. */
export const parseKeycloakConfig = (env: EnvSource): KeycloakOptions => ({
    tokenUrl: env.url("KEYCLOAK_TOKEN_URL"),
    clientId: env.string("KEYCLOAK_CLIENT_ID"),
    timeoutMs: env.duration("KEYCLOAK_TIMEOUT", 10_000),
})
