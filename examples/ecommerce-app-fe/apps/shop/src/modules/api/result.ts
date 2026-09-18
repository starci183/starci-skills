/**
 * What a service read returns: the payload, or the reason there is none. Pages render this union honestly —
 * an unreachable service is an empty state with the reason, never a fabricated success.
 */
export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly reason: string };
