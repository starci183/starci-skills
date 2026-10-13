/** The signed-in reader as the identity provider states it; the back end verifies the access token on every call. */
export interface AuthSession {
    readonly userId: string
    readonly email?: string
}

/** The answer of a sign-in or sign-out: done, or why not (`refused` credentials, `invalid` input, provider `unavailable`). */
export type AuthOutcome =
    { readonly kind: "ok" } | { readonly kind: "refused" | "invalid" | "unavailable"; readonly code: string }

/**
 * The identity-provider client of the app, the same interface in every edition: the session, the access token the Apollo
 * link attaches, one forced refresh for the UNAUTHENTICATED replay, the sign-in and sign-out calls and a change listener.
 * It never reads or writes application data; data goes through modules/api.
 */
export interface AuthClient {
    session(): Promise<AuthSession | undefined>
    accessToken(): Promise<string | undefined>
    refreshAccessToken(): Promise<string | undefined>
    signInWithPassword(email: string, password: string): Promise<AuthOutcome>
    signOut(): Promise<AuthOutcome>
    onChange(listener: (session: AuthSession | undefined) => void): () => void
}
