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
