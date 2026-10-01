/** A member as the identity provider names them. */
export interface KeycloakMember {
    /** The stable subject id of the member. */
    readonly id: string
    /** The email of the member. */
    readonly email: string
    /** The name the member goes by. */
    readonly displayName: string
}

/** The service account's access token and the instant it is renewed at (epoch milliseconds, before Keycloak's expiry). */
export interface CachedAccessToken {
    /** The bearer token. */
    readonly value: string
    /** When the next call asks for a new one. */
    readonly renewAt: number
}
