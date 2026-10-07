// ask-gateway-routes.mjs — the paths a serve-ask form answers (scripts/kernel/ask-server.mjs), as a table of constants.
// The gateway never forwards the caller's path string: it matches the incoming path against this table and builds the
// upstream path from the table's own segments plus the values that passed a strict validator and were re-encoded.
// The form answers GET /<nonce>, GET /<nonce>/img/<index> and POST /<nonce>/answer, and ignores the query string.

const TOKEN = /^[A-Za-z0-9_-]{1,64}$/;
const INDEX = /^\d{1,6}$/;

/** What follows `/<nonce>`: each route is a list of segments, a constant string or a validator for one value. */
const ASK_ROUTES = Object.freeze([
  Object.freeze([]),
  Object.freeze(['img', INDEX]),
  Object.freeze(['answer']),
]);

const matches = (route, segments) => route.length === segments.length
  && route.every((part, i) => (typeof part === 'string' ? part === segments[i] : part.test(segments[i])));

/**
 * The upstream path for `pathname` (`/<nonce>[/...]`), rebuilt from ASK_ROUTES constants and re-encoded validated values,
 * or null when the path is not one the form serves (nothing else is ever forwarded).
 */
export function askUpstreamPath(pathname) {
  const [lead, nonce, ...rest] = String(pathname ?? '').split('/');
  if (lead !== '' || !TOKEN.test(nonce ?? '')) return null;
  const route = ASK_ROUTES.find((candidate) => matches(candidate, rest));
  if (!route) return null;
  const tail = route.map((part, i) => (typeof part === 'string' ? part : encodeURIComponent(rest[i])));
  return `/${[encodeURIComponent(nonce), ...tail].join('/')}`;
}
