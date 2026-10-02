import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../../../../supabase/types/database.types"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"

/** Creates the typed public client used only by client-side auth lifecycle hooks. */
export const createBrowserDbClient = (): SupabaseClient<Database> =>
    createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey())
