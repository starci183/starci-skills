import { createBrowserClient } from "@supabase/ssr"
import type { Session, SupabaseClient } from "@supabase/supabase-js"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"
import type { AuthClient, AuthFailure, AuthSession } from "./contracts"

let client: SupabaseClient | undefined

/**
 * The cookie-backed browser client of the opt-in server PKCE flow, used for Supabase Auth only.
 * The callback exchanges the code; this client shares its verifier and session cookies. It never calls `.from()`, `.rpc()` or storage:
 * data goes through modules/api to the back end, which verifies the access token.
 */
const supabase = (): SupabaseClient =>
    (client ??= createBrowserClient(supabaseUrl(), supabaseAnonKey(), {
        auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
    }))

// {{> fe/auth/supabase-client.ts.tpl}}
