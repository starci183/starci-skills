import type { SupabasePrincipal } from "@modules/integrations/supabase"

/** Why a door is open to anonymous callers; the vocabulary is closed. */
export enum PublicReason {
    /** Liveness and readiness probes. */
    Health = "health",
}

/** The metadata `@Public` attaches to a door. */
export interface PublicMetadata {
    /** Why the door is anonymous. */
    readonly reason: PublicReason
}

/** The only authenticated principal: claims from a cryptographically verified Supabase access token. */
export type Principal = SupabasePrincipal

/** What identity admission returns to the guard. */
export type IdentityAdmission = Principal | PublicReason
