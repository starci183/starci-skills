// The declared read-only request-show call; absent or unreadable never proves no effect.
import { orcaCall, requestStateFrom } from './lib.mjs';

export function requestShow({ request }) {
  const state = requestStateFrom(orcaCall('request-show', { request }));
  return { ok: state !== null, state };
}
