import type { Secret } from "@modules/platform/config"

/** Options of the keycloak admin integration: a confidential service-account client of the realm. */
export interface KeycloakAdminOptions {
    /** The base URL of the Keycloak server. */
    readonly url: string
    /** The realm the members live in. */
    readonly realm: string
    /** The confidential client whose service account may read the realm's users (realm-management view-users). */
    readonly clientId: string
    /** The secret of that client; a secret. */
    readonly clientSecret: Secret
    /** How long a call waits for the answer. */
    readonly timeoutMs: number
}
