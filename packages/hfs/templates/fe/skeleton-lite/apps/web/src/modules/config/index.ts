/** The only process-environment reader in the web app. */
const required = (name: string, value: string | undefined): string => {
    if (value === undefined || value === "") throw new Error(`${name} is not set`)
    return value
}

/** The public origin used for metadata and same-origin redirects. */
export const siteUrl = (): string => required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL)
/** The public Supabase project origin. */
export const supabaseUrl = (): string => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
/** The public anonymous key; RLS remains the authority for every request. */
export const supabaseAnonKey = (): string =>
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

/** Security attributes applied whenever the app writes a Supabase session cookie. */
export const sessionCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
} as const
