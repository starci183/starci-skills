/** Options of the keycloak integration. */
export interface KeycloakOptions {
    /** The token endpoint of the realm. */
    readonly tokenUrl: string
    /** The client id this product presents to the realm. */
    readonly clientId: string
    /** How long a round-trip to the realm may take. */
    readonly timeoutMs: number
}
