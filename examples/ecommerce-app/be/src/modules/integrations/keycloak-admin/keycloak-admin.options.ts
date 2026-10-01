import type { Secret } from "@modules/platform/config"

/** Options of the keycloak admin integration. */
export interface KeycloakAdminOptions {
    /** The base URL of the Keycloak server. */
    readonly url: string
    /** The realm the members live in. */
    readonly realm: string
    /** The service-account bearer token of the admin API; a secret. */
    readonly token: Secret
    /** How long a call waits for the answer. */
    readonly timeoutMs: number
}
