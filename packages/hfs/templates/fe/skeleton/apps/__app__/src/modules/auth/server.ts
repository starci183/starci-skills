import "server-only"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAnonKey, supabaseUrl } from "@/modules/config"

/** The server auth owner reads the PKCE verifier and persists the exchanged session in cookies. */
export async function exchangeAuthCode(code: string): Promise<void> {
    const cookieStore = await cookies()
    const client = createServerClient(supabaseUrl(), supabaseAnonKey(), {
        cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (values) => {
                for (const { name, value, options } of values) cookieStore.set(name, value, options)
            },
        },
    })
    const { error } = await client.auth.exchangeCodeForSession(code)
    if (error) throw error
}
