// The declared read-only request-show call; absent or unreadable never proves no effect.
import { requestStateOf } from './lib.mjs';

export function requestShow({ request }) {
  const state = requestStateOf(request);
  return { ok: state !== null, state };
}
