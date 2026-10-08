// The declared read-only request-show call; absent or unreadable never proves no effect.
import { orcaCall, requestStateFrom } from './lib.mjs';

/**
 * Reads the state of an exact retry-request identity without issuing its mutation.
 * Returns the declared request state, or null with ok false when the state cannot be established.
 * Neither an absent state nor an unreadable response proves that the mutation had no effect.
 * dispatchId is the Dispatch a recorded workerStart receipt names, or null.
 */
export function requestShow({ request }) {
  const envelope = orcaCall('request-show', { request });
  const state = requestStateFrom(envelope);
  return { ok: state !== null, state, dispatchId: envelope?.result?.receipt?.dispatchId ?? null };
}
