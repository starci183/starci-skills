/** A shopper to create in the realm. */
export interface CreateMemberParams {
    /** The email, also the username the shopper signs in with. */
    readonly email: string
    /** The password, handed to Keycloak and never stored by the product. */
    readonly password: string
}

/** A shopper the realm created. */
export interface CreatedMember {
    /** The subject id the realm gave the user: the person id of the product. */
    readonly id: string
}

/** The service account's access token and the instant it is renewed at (epoch milliseconds, before Keycloak's expiry). */
export interface CachedAccessToken {
    /** The bearer token. */
    readonly value: string
    /** When the next call asks for a new one. */
    readonly renewAt: number
}
