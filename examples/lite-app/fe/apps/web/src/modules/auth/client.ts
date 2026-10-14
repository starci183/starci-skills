import { createBrowserClient } from "@supabase/ssr"
import type { Session, SupabaseClient } from "@supabase/supabase-js"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"
import type { AuthClient, AuthOutcome, AuthSession } from "./contracts"

let client: SupabaseClient | undefined

/**
 * The cookie-backed browser client of the server PKCE flow, used for Supabase Auth only.
 * The callback exchanges the code; this client shares its verifier and session cookies. It never calls `.from()`, `.rpc()` or storage:
 * data goes through modules/api to the back end, which verifies the access token.
 */
const supabase = (): SupabaseClient =>
    (client ??= createBrowserClient(supabaseUrl(), supabaseAnonKey(), {
        auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
    }))

const sessionOf = (session: Session | null): AuthSession | undefined =>
    session === null
        ? undefined
        : { userId: session.user.id, ...(session.user.email === undefined ? {} : { email: session.user.email }) }

/** The outcome of a Supabase Auth error: refused credentials, rejected input, or the provider unavailable. */
const outcomeOf = (error: { readonly status?: number; readonly code?: string } | null): AuthOutcome => {
    if (error === null) return { kind: "ok" }
    const code = error.code ?? String(error.status ?? "auth")
    if (error.status === 400 || error.status === 401 || error.status === 403) return { kind: "refused", code }
    if (error.status === 422) return { kind: "invalid", code }
    return { kind: "unavailable", code }
}

/** The identity-provider client of a lite app: Supabase Auth in the browser. */
export const authClient: AuthClient = {
    session: async () => sessionOf((await supabase().auth.getSession()).data.session),
    accessToken: async () => (await supabase().auth.getSession()).data.session?.access_token,
    refreshAccessToken: async () => (await supabase().auth.refreshSession()).data.session?.access_token,
    signInWithPassword: async (email, password) =>
        outcomeOf((await supabase().auth.signInWithPassword({ email, password })).error),
    signOut: async () => outcomeOf((await supabase().auth.signOut()).error),
    onChange: (listener) => {
        const { data } = supabase().auth.onAuthStateChange((_event, session) => listener(sessionOf(session)))
        return () => data.subscription.unsubscribe()
    },
}
