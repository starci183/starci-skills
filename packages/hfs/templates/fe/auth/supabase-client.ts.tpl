const sessionOf = (session: Session | null): AuthSession | undefined =>
    session === null
        ? undefined
        : { userId: session.user.id, ...(session.user.email === undefined ? {} : { email: session.user.email }) }

/** A Supabase Auth error as the provider reports it: its HTTP status, its code and its message. */
type ProviderError = {
    readonly status: number | undefined
    readonly code: string | undefined
    readonly message: string
}

/** The failure kind of a Supabase Auth error: refused credentials, rejected input, or the provider unavailable. */
const kindOf = (status: number | undefined): string => {
    if (status === 400 || status === 401 || status === 403) return "refused"
    return status === 422 ? "invalid" : "unavailable"
}

/** The failure of a Supabase Auth call, or undefined when it succeeded. */
const failureOf = (error: ProviderError | null): AuthFailure | undefined =>
    error === null
        ? undefined
        : { code: error.code ?? String(error.status ?? "auth"), kind: kindOf(error.status), message: error.message }

/** The Supabase Auth adapter shared by browser and cookie-backed PKCE flows. */
export const authClient: AuthClient = {
    session: async () => sessionOf((await authOf().getSession()).data.session),
    accessToken: async () => (await authOf().getSession()).data.session?.access_token,
    refreshAccessToken: async () => (await authOf().refreshSession()).data.session?.access_token,
    signInWithPassword: async (email, password) =>
        failureOf((await authOf().signInWithPassword({ email, password })).error),
    signOut: async () => failureOf((await authOf().signOut()).error),
    // Supabase reports INITIAL_SESSION on subscribe, then every change: the subscription alone keeps the session current.
    onChange: (listener) => {
        const { data } = authOf().onAuthStateChange((_event, session) => listener(sessionOf(session)))
        return () => data.subscription.unsubscribe()
    },
}
