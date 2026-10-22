/** The signed-in shopper as the identity service named them when it opened the session. */
export interface AuthSession {
    readonly personId: string
}

/** What the identity service's `signIn` answers: the opaque bearer and the person it authenticates. */
export interface IssuedSession {
    readonly sessionToken: string
    readonly personId: string
}

/**
 * The session client of the shop. The identity service is the identity provider: `signIn` mints an opaque bearer that the
 * browser keeps here and the Apollo link attaches to every authenticated operation. It never reads or writes application
 * data; data goes through modules/api.
 */
export interface AuthClient {
    /** The session the browser holds now, if any (read from browser storage, no request). */
    session(): AuthSession | undefined
    /** The bearer of the current session, for `Authorization: Bearer`. */
    accessToken(): Promise<string | undefined>
    /**
     * The renewal the Apollo refresh link asks for on UNAUTHENTICATED: an identity session cannot be renewed, so the dead
     * session is ended and nothing comes back.
     */
    refreshAccessToken(): Promise<string | undefined>
    /** Keeps the session `signIn` issued and tells every listener. */
    establish(issued: IssuedSession): void
    /** Forgets the session locally and tells every listener (the revoke at the identity service is the caller's). */
    end(): void
    /** Calls the listener on every change of the session; answers the unsubscribe. */
    onChange(listener: (session: AuthSession | undefined) => void): () => void
}
