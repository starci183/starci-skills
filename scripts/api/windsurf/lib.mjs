// scripts/api/windsurf/lib.mjs — the runner of the Windsurf (Codeium) seat API: one Connect-JSON POST
// (content-type application/json, connect-protocol-version 1). The call file beside it (seat-quota.mjs) names its one use;
// nothing outside scripts/api/windsurf imports this runner. The request carries an API key: nothing here logs or echoes it.
import { isLoopbackHost } from '../../lib/loopback-host.mjs';

/** The seat API's server hosts (devin's credentials.toml: "API server: https://server.codeium.com"); the key goes to these over https only. */
const SEAT_HOSTS = new Set(['server.codeium.com']);

/** The endpoint's URL when it may carry the key (a seat host over https, or a loopback http(s) server of this machine), else a URL_TARGET_REFUSED error is thrown. */
function seatEndpoint(endpoint) {
  const refuse = (reason) => Object.assign(new Error(`seat endpoint refused: ${reason} [URL_TARGET_REFUSED]`), { code: 'URL_TARGET_REFUSED' });
  let url;
  try { url = new URL(String(endpoint)); } catch { throw refuse('not a URL'); }
  if (url.username || url.password) throw refuse('a URL with credentials');
  const seat = url.protocol === 'https:' && SEAT_HOSTS.has(url.hostname);
  const local = (url.protocol === 'https:' || url.protocol === 'http:') && isLoopbackHost(url.hostname);
  if (!seat && !local) throw refuse(`${url.protocol}//${url.hostname} is not a seat API host`);
  return url;
}

/** {status, body} of the POST (body clipped to 64 KiB), or {status: 0, error} when it could not complete. Never throws. */
export async function connectPost(endpoint, payload, timeoutMs) {
  try {
    const res = await fetch(seatEndpoint(endpoint), {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json', 'connect-protocol-version': '1' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 65536) };
  } catch (error) {
    return { status: 0, error: String((error && error.message) || error) };
  }
}
