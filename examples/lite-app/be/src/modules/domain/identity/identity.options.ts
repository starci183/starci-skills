import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"

/** The verified identity source used by the default-deny guard. */
export interface IdentityOptions {
    /** Cryptographically verifies a Supabase access token before it can become a principal. */
    readonly verifyAccessToken: VerifySupabaseAccessToken
}
