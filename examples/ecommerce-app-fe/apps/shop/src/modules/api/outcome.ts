/**
 * What a service read returns: the payload, or the reason there is none. Pages render this union honestly —
 * an unreachable service is an empty state with the reason, never a fabricated success.
 *
 * `code` carries the door's stable machine answer (`INVALID_CREDENTIALS`, `EMAIL_TAKEN`,
 * `SESSION_INVALID`, ...) when one exists — GraphQL's `extensions.code` or the flat `code` the
 * REST business-code filter stamps — so a caller maps a named refusal to its own copy instead of
 * parsing sentences.
 */
export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly reason: string; readonly code?: string };

/**
 * The extensions envelope a GraphQL error carries. The backend's `formatError` writes the stable
 * business code (`SESSION_INVALID`, `CHECKOUT_REFUSAL`, ...) onto `code` and spreads the
 * exception's metadata beside it, so a refusal's `reason`, `productId`, `requested` and
 * `available` survive the trip.
 */
export type GraphqlExtensions = { readonly code?: string } & Record<string, unknown>

/**
 * What one GraphQL call returns: the payload, or the refusal. `code`/`extensions` ride beside the
 * human reason so a caller can tell a named business refusal from a transport failure. The failed
 * branch is a superset of `Result`'s, so a caller that only wants `ok`/`reason` can still take it.
 */
export type GraphqlResult<T> =
    | { readonly ok: true; readonly data: T }
    | { readonly ok: false; readonly reason: string; readonly code?: string; readonly extensions?: GraphqlExtensions };
