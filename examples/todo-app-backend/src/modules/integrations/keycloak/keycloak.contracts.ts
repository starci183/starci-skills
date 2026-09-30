/** What a sign-in against the provider takes. */
export interface KeycloakSignInParams {
    /** The email the person typed. */
    readonly email: string
    /** The password the person typed; it goes to the provider and nowhere else. */
    readonly password: string
}

/** What the provider vouches for after a sign-in. */
export interface KeycloakSignIn {
    /** The stable subject id of the person, read from the access token. */
    readonly subject: string
}

/** What the sign-out notice takes. */
export interface KeycloakSignOutParams {
    /** The person whose session was revoked. */
    readonly personId: string
}
