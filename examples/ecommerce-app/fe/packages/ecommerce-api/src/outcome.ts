/**
 * The one result every call of the repository answers in: a status is a kind, never a thrown error and
 * never `null`. `code` is the door's stable machine answer (`SESSION_INVALID`, `ACCOUNT_INVALID_CREDENTIALS`,
 * `ACCOUNT_EMAIL_TAKEN`, `ORDER_INSUFFICIENT_STOCK`, ...) when one exists, and `details` carries the fields a named
 * business refusal brings along (the product it is about, how much was asked, how much was there). The
 * words a reader sees are the dictionary's, never the server's text.
 */
export type Outcome<T> =
    | { readonly kind: "ok"; readonly data: T }
    | { readonly kind: "refused"; readonly code?: string }
    | { readonly kind: "invalid"; readonly code?: string; readonly details?: Readonly<Record<string, unknown>> }
    | { readonly kind: "not-found" }
    | { readonly kind: "unavailable" }
