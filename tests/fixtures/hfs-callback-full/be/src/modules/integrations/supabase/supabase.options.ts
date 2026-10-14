import type { Secret } from "@modules/platform/config"
import type { Outcome } from "@modules/platform/primitives"
import type { SupabaseErrorCode } from "./errors/supabase.error"

/** The verified identity claims admitted from a Supabase access token. */
export interface SupabasePrincipal {
    /** The Auth user identifier from the verified `sub` claim. */
    readonly id: string
    /** The verified email claim when the provider issued one. */
    readonly email?: string
    /** Supabase's authenticated role, required by the verifier. */
    readonly role: "authenticated"
}

/** Verifies one bearer token and returns only claims that passed every cryptographic and semantic check. */
export type VerifySupabaseAccessToken = (token: string) => Promise<Outcome<SupabasePrincipal, SupabaseErrorCode>>

/** Supabase configuration parsed once at API boot. */
export interface SupabaseOptions {
    /** The project origin, used for Auth, Storage, issuer and JWKS endpoints. */
    readonly url: string
    /** The service-role credential, held only by the back-end integration. */
    readonly serviceRoleKey: Secret
}
