import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"
import type { Database } from "../../../../../../supabase/types/database.types"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"

/** Creates the cookie-backed server client; the public key keeps every database call under RLS. */
export const createServerDbClient = async (): Promise<SupabaseClient<Database>> => {
    const store = await cookies()
    return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
        cookies: {
            getAll: () => store.getAll(),
            setAll: (changes) => {
                try {
                    for (const change of changes) store.set(change.name, change.value, change.options)
                } catch {
                    // Server Components cannot write cookies; proxy.ts owns refresh before they render.
                }
            },
        },
    })
}

/** Creates the proxy client and writes every refreshed cookie onto the response that will be returned. */
export const createRequestDbClient = (request: NextRequest, response: NextResponse): SupabaseClient<Database> =>
    createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (changes) => {
                for (const change of changes) {
                    request.cookies.set(change.name, change.value)
                    response.cookies.set(change.name, change.value, change.options)
                }
            },
        },
    })
