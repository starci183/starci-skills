import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../../../../supabase/types/database.types"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"

/** Creates the typed public client used only by client-side auth lifecycle hooks. */
const createBrowserDbClient = (): SupabaseClient<Database> =>
    createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey())

/** Owns the browser Auth subscription and exposes only its lifecycle to client hooks. */
export const subscribeToAuthRefresh = (refresh: () => void): (() => void) => {
    const listener = createBrowserDbClient().auth.onAuthStateChange(refresh)
    return () => listener.data.subscription.unsubscribe()
}
