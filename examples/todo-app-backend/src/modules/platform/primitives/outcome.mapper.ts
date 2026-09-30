import type { ErrorParams } from "@modules/platform/errors"
import type { Outcome, OutcomeErrorClass, OutcomeOk, OutcomeRefused } from "./outcome.contracts"

/** Wraps a produced value as a successful outcome. */
export const ok = <V>(value: V): OutcomeOk<V> => ({ kind: "ok", value })

/** Builds a refusal with a capability code and the parameters of its display text. */
export const refused = <C extends string>(code: C, params?: ErrorParams): OutcomeRefused<C> => ({
    kind: "refused",
    code,
    params,
})

/**
 * Returns the value of a successful outcome; a refusal becomes the capability error of `ErrorClass`. This is the only
 * place a refusal turns into a throw, and it runs in the transport.
 */
export const unwrapOutcome = <V, C extends K, K extends string>(
    outcome: Outcome<V, C>,
    ErrorClass: OutcomeErrorClass<K>,
): V => {
    if (outcome.kind === "ok") return outcome.value
    throw new ErrorClass({ code: outcome.code, params: outcome.params })
}
