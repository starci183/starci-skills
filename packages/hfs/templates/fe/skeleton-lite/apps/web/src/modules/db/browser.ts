import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../../../../supabase/types/database.types"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"
import { dbFailure, dbOk } from "./outcome"
import type { DbOutcome } from "./outcome"

const createBrowserDbClient = (): SupabaseClient<Database> =>
    createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey())

/** Ends the browser's Supabase session and returns the shared app outcome. */
export const signOutBrowserSession = async (): Promise<DbOutcome<true>> => {
    const result = await createBrowserDbClient().auth.signOut()
    if (result.error === null) return dbOk(true)
    return dbFailure(result.error.status === 401 ? "refused" : "unavailable", result.error.code ?? "sign-out")
}
