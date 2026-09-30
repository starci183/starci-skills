/** The closed reasons an operation may be public (fixture). */
export enum PublicReason {
    /** A health probe. */
    Health = "health",
    /** The sign-in handshake. */
    AuthHandshake = "auth-handshake",
}
