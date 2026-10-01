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
    /** The refresh token of the provider session the grant opened: what ends that session at sign-out. */
    readonly refreshToken: string
}

/** What ending the provider session takes. */
export interface KeycloakSignOutParams {
    /** The refresh token the sign-in grant returned for the session. */
    readonly refreshToken: string
}
