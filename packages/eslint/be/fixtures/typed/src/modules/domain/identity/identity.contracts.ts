/** The closed reasons an operation may be public (fixture). */
export enum PublicReason {
    /** A health probe. */
    Health = "health",
    /** The sign-in handshake. */
    AuthHandshake = "auth-handshake",
    /** A provider callback authenticated by signature. */
    SignedWebhook = "signed-webhook",
}

/** Fixture: the Pii brand of identity. */
export type Pii<T> = T & { readonly __pii: true }
