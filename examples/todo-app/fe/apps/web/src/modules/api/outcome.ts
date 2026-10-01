/**
 * The one result every read of the backend returns: a status is a kind, never a thrown error and
 * never `null`. `code` is the backend's stable domain code when it sent one; the words a reader sees
 * are the dictionary's, never the server's text.
 */
export type Outcome<T> =
    | { readonly kind: "ok"; readonly data: T }
    | { readonly kind: "refused"; readonly code?: string }
    | { readonly kind: "invalid"; readonly code?: string }
    | { readonly kind: "not-found" }
    | { readonly kind: "unavailable" }
