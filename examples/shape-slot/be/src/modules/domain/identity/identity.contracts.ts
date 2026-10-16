import type { CredentialPrincipal } from "./credential.contracts"

declare module "express-serve-static-core" {
    /** The request carries what the credential guard established. */
    interface Request {
        /** The identity `CredentialGuard` authenticated on a door marked `@Credential`; never a session principal. */
        credentialPrincipal?: CredentialPrincipal
    }
}

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
