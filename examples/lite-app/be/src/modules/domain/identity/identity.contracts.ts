import type { SupabasePrincipal } from "@modules/integrations/supabase"

declare module "express-serve-static-core" {
    /** The request carries the principal established by the default-deny auth guard. */
    interface Request {
        /** The authenticated Supabase caller, when the door is not public. */
        principal?: SupabasePrincipal
    }
}

/** Why a door is open to anonymous callers; the vocabulary is closed. */
export enum PublicReason {
    /** Liveness and readiness probes. */
    Health = "health",
    /** A webhook whose signature is verified before its domain intake runs. */
    SignedWebhook = "signed-webhook",
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
