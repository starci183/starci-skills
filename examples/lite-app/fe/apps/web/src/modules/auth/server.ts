import "server-only"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"
import { authCookieOptions } from "./client"

/** The server auth owner reads the PKCE verifier and persists the exchanged session in cookies. */
export const exchangeAuthCode = async (code: string): Promise<void> => {
    const cookieStore = await cookies()
    const cookieOptions = authCookieOptions()
    const client = createServerClient(supabaseUrl(), supabaseAnonKey(), {
        cookieOptions,
        cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (values) => {
                for (const { name, value, options } of values)
                    cookieStore.set(name, value, { ...options, ...cookieOptions })
            },
        },
    })
    const { error } = await client.auth.exchangeCodeForSession(code)
    if (error) throw error
}
