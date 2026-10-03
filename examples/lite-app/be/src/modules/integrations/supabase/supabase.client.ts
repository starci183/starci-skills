import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../../../supabase/types/database.types"
import type { SupabaseOptions } from "./supabase.options"

/** The privileged surface exposed by this integration: Auth administration and Storage, never database queries. */
export interface SupabaseAdminClient {
    /** Supabase Auth administration. */
    readonly auth: SupabaseClient<Database>["auth"]["admin"]
    /** Supabase Storage administration. */
    readonly storage: SupabaseClient<Database>["storage"]
}

/** Creates the back-end-only client and narrows it to Auth and Storage administration. */
export const createSupabaseAdminClient = (options: SupabaseOptions): SupabaseAdminClient => {
    const client: SupabaseClient<Database> = createClient<Database>(options.url, options.serviceRoleKey.reveal(), {
        auth: {
            autoRefreshToken: false,
            detectSessionInUrl: false,
            persistSession: false,
        },
    })
    return { auth: client.auth.admin, storage: client.storage }
}
