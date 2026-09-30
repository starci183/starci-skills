/** The one result every read of the backend returns: a status is a kind, never a thrown error and never `null`. */
export type Outcome<T> =
    | { readonly kind: "ok"; readonly data: T }
    | { readonly kind: "refused" }
    | { readonly kind: "invalid" }
    | { readonly kind: "not-found" }
    | { readonly kind: "unavailable" }
