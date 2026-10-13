/** The signed-in reader as the identity provider states it; the back end verifies the access token on every call. */
export interface AuthSession {
    readonly userId: string
    readonly email?: string
}

/** Why a sign-in or sign-out failed: the provider's code, its kind (`refused`, `invalid`, `unavailable`) and its message. */
export interface AuthFailure {
    readonly code: string
    readonly kind: string
    readonly message: string
}

/**
 * The identity-provider client of the app, the same interface in every edition: the session, the access token the Apollo
 * link attaches, one forced refresh for the UNAUTHENTICATED replay, the sign-in and sign-out calls (each answers its failure,
 * or undefined when it succeeded) and a change listener that reports the current session on subscribe, then every change.
 * It never reads or writes application data; data goes through modules/api.
 */
export interface AuthClient {
    session(): Promise<AuthSession | undefined>
    accessToken(): Promise<string | undefined>
    refreshAccessToken(): Promise<string | undefined>
    signInWithPassword(email: string, password: string): Promise<AuthFailure | undefined>
    signOut(): Promise<AuthFailure | undefined>
    onChange(listener: (session: AuthSession | undefined) => void): () => void
}
