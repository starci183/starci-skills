import { createBrowserClient } from "@supabase/ssr"
import type { Session, SupabaseClient } from "@supabase/supabase-js"
import { cookieSecure, supabaseAnonKey, supabaseUrl } from "@/modules/config"
import type { AuthClient, AuthFailure, AuthSession } from "./contracts"

/**
 * Supabase's browser client reads the shared PKCE and session cookies to refresh tokens and sign GraphQL requests.
 * Keep them script-readable, with the same explicit transport and cross-site policy on both clients.
 */
export const authCookieOptions = () => ({ httpOnly: false, secure: cookieSecure(), sameSite: "lax" }) as const

let authentication: SupabaseClient["auth"] | undefined

/**
 * The cookie-backed browser client of the server PKCE flow, used for Supabase Auth only.
 * The callback exchanges the code; this client shares its verifier and session cookies. It never calls `.from()`, `.rpc()` or storage:
 * data goes through modules/api to the back end, which verifies the access token.
 */
const authOf = (): SupabaseClient["auth"] =>
    (authentication ??= createBrowserClient(supabaseUrl(), supabaseAnonKey(), {
        cookieOptions: authCookieOptions(),
        auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
    }).auth)

const sessionOf = (session: Session | null): AuthSession | undefined =>
    session === null
        ? undefined
        : { userId: session.user.id, ...(session.user.email === undefined ? {} : { email: session.user.email }) }

/** A Supabase Auth error as the provider reports it: its HTTP status, its code and its message. */
type ProviderError = { readonly status: number | undefined; readonly code: string | undefined; readonly message: string }

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

/** The identity-provider client of a lite app: Supabase Auth in the browser. */
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
