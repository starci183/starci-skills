/** Failure vocabulary shared by every app boundary. */
export type OutcomeFailureKind = "refused" | "not-found" | "invalid" | "unavailable"

/** A successful app operation. */
export interface OutcomeOk<T> {
    readonly kind: "ok"
    readonly value: T
}

/** An expected failure with a stable kind and provider code. */
export interface OutcomeFailure {
    readonly kind: OutcomeFailureKind
    readonly code: string
}

/** The one result vocabulary used by every app operation. */
export type Outcome<T> = OutcomeOk<T> | OutcomeFailure

/** Wraps a value as a successful outcome. */
export const outcomeOk = <T>(value: T): OutcomeOk<T> => ({ kind: "ok", value })

/** Builds an expected failure without throwing across a boundary. */
export const outcomeFailure = (kind: OutcomeFailureKind, code: string): OutcomeFailure => ({ kind, code })
