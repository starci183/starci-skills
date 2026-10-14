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
