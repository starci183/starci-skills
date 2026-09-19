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
