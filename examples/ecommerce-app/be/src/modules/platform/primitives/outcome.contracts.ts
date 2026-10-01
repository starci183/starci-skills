import type { DomainError, DomainErrorInit, ErrorParams } from "@modules/platform/errors"

/** The success half of an outcome: the value the operation produced. */
export interface OutcomeOk<V> {
    /** Discriminant of the success half. */
    readonly kind: "ok"
    /** The value the operation produced. */
    readonly value: V
}

/** The expected-refusal half of an outcome: a capability code and the parameters of its display text. */
export interface OutcomeRefused<C extends string> {
    /** Discriminant of the refusal half. */
    readonly kind: "refused"
    /** The capability code of the refusal, a member of its code enum. */
    readonly code: C
    /** Values for the placeholders of the display text. */
    readonly params?: ErrorParams
}

/** The result of an operation that can be refused for an expected business reason: returned, never thrown. */
export type Outcome<V, C extends string> = OutcomeOk<V> | OutcomeRefused<C>

/** The error class of one capability, as `unwrapOutcome` constructs it from a refusal. */
export interface DomainErrorClass<K extends string> {
    /** Builds the capability error carrying the code and parameters of a refusal. */
    new (init: DomainErrorInit<K>): DomainError<K>
}
