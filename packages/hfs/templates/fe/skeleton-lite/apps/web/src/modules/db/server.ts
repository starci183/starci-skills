import "server-only"

import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"
import type { Database } from "../../../../../../supabase/types/database.types"
import { sessionCookieOptions, supabaseAnonKey, supabaseUrl } from "@/modules/config"

/** Creates the cookie-backed server client; the public key keeps every database call under RLS. */
export const createServerDbClient = async (): Promise<SupabaseClient<Database>> => {
    const store = await cookies()
    return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
        cookies: {
            getAll: () => store.getAll(),
            setAll: (changes) => {
                try {
                    for (const change of changes) {
                        store.set(change.name, change.value, {
                            ...change.options,
                            ...sessionCookieOptions,
                        })
                    }
                } catch (cause) {
                    if (!(cause instanceof Error) || !cause.message.includes("Cookies can only be modified"))
                        throw cause
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
                    response.cookies.set(change.name, change.value, {
                        ...change.options,
                        ...sessionCookieOptions,
                    })
                }
            },
        },
    })
