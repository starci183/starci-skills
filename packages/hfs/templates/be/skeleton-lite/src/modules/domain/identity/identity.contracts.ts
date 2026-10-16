import type { Principal } from "@modules/platform/cqrs"
import type { CredentialPrincipal } from "./credential.contracts"

declare module "express-serve-static-core" {
    /** The request carries the separate principals established by the identity guards. */
    interface Request {
        /** The identity `CredentialGuard` authenticated on a door marked `@Credential`; never a session principal. */
        credentialPrincipal?: CredentialPrincipal
        /** The authenticated Supabase caller, when the door is not public. */
        principal?: Principal
    }
}

/** Why a door is open to anonymous callers; the vocabulary is closed. */
export enum PublicReason {
    /** Liveness and readiness probes. */
    Health = "health",
    /** The authentication protocol's anonymous handshake. */
    AuthHandshake = "auth-handshake",
    /** A webhook whose signature is verified before its domain intake runs. */
    SignedWebhook = "signed-webhook",
    /** A declared public catalog read. */
    CatalogRead = "catalog-read",
}

/** The metadata `@Public` attaches to a door. */
export interface PublicMetadata {
    /** Why the door is anonymous. */
    readonly reason: PublicReason
}

/** What identity admission returns to the guard. */
export type IdentityAdmission = Principal | CredentialPrincipal | PublicReason
