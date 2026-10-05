// The declared read-only request-show call; absent or unreadable never proves no effect.
import { orcaCall, requestStateFrom } from './lib.mjs';

/**
 * Reads the state of an exact retry-request identity without issuing its mutation.
 * Returns the declared request state, or null with ok false when the state cannot be established.
 * Neither an absent state nor an unreadable response proves that the mutation had no effect.
 */
export function requestShow({ request }) {
  const state = requestStateFrom(orcaCall('request-show', { request }));
  return { ok: state !== null, state };
}
