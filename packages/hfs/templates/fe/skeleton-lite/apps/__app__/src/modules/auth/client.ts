import { createClient } from "@supabase/supabase-js"
import type { Session, SupabaseClient } from "@supabase/supabase-js"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"
import type { AuthClient, AuthFailure, AuthSession } from "./contracts"

let authentication: SupabaseClient["auth"] | undefined

/**
 * The one Supabase client of the front end, used for Supabase Auth only (the PKCE flow runs in the browser: a returning
 * redirect's code is exchanged by `detectSessionInUrl`, no route handler). It never calls `.from()`, `.rpc()` or storage:
 * data goes through modules/api to the back end, which verifies the access token.
 */
const authOf = (): SupabaseClient["auth"] =>
    (authentication ??= createClient(supabaseUrl(), supabaseAnonKey(), {
        auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    }).auth)

// {{> fe/auth/supabase-client.ts.tpl}}
