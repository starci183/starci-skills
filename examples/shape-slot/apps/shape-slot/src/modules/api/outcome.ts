/** One field the server refused, as a code and the field it belongs to; never server prose. */
export type Issue = { readonly field: string; readonly code: string }

/**
 * The one result vocabulary of the transport. A status is never collapsed into null or into one failure branch:
 * 401 and 403 are `refused`, 404 is `not-found`, 400 and 422 are `invalid`, everything else is `unavailable`.
 */
export type Outcome<T> =
    | { readonly kind: "ok"; readonly value: T }
    | { readonly kind: "refused"; readonly status: 401 | 403; readonly code: string }
    | { readonly kind: "invalid"; readonly issues: ReadonlyArray<Issue> }
    | { readonly kind: "not-found" }
    | { readonly kind: "unavailable"; readonly code: string; readonly retryable: boolean }

/** The outcome an HTTP status maps to; `ok` is the caller's, it carries a value. */
export const outcomeOfStatus = (status: number): Exclude<Outcome<never>, { kind: "ok" }> => {
    if (status === 401 || status === 403) return { kind: "refused", status, code: `http-${status}` }
    if (status === 404) return { kind: "not-found" }
    if (status === 400 || status === 422) return { kind: "invalid", issues: [] }
    return { kind: "unavailable", code: `http-${status}`, retryable: status >= 500 }
}

/** The HTTP status an outcome stands for, for the one consumer that folds it into a slot (`toSlot`). */
export const statusOfOutcome = (outcome: Exclude<Outcome<unknown>, { kind: "ok" }>): number => {
    switch (outcome.kind) {
        case "refused":
            return outcome.status
        case "not-found":
            return 404
        case "invalid":
            return 422
        case "unavailable":
            return 503
    }
}
