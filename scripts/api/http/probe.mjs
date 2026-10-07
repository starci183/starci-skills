// One HTTP header probe, with one wall-clock deadline across DNS, connect and redirects. Never throws.
// A 301/302/303 becomes GET (HEAD stays HEAD), a 307/308 preserves method/body; follow:0 answers the redirect.
import { transportOf } from './lib.mjs';

const REDIRECT = new Set([301, 302, 303, 307, 308]);
const DOWN = new Set(['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND', 'EADDRNOTAVAIL']);
const supported = target => target.protocol === 'http:' || target.protocol === 'https:';

const once = (target, { method, body, signal, started }) => new Promise(resolve => {
  let connected = false, done = false, req, response, upgraded;
  const finish = value => {
    if (done) return;
    done = true; signal.removeEventListener('abort', deadline);
    // Health only needs headers. Do not leave an unbounded response body draining after the answer.
    response?.destroy(); upgraded?.destroy(); req?.destroy();
    resolve(value);
  };
  const deadline = () => finish(connected
    ? { state: 'hung', ms: Date.now() - started }
    : { state: 'down', code: 'CONNECT_TIMEOUT', ms: Date.now() - started });
  if (signal.aborted) { deadline(); return; }
  signal.addEventListener('abort', deadline, { once: true });
  try {
    req = transportOf(target).request(target, { method, headers: body ? {
      'content-type': 'application/json', 'content-length': Buffer.byteLength(body),
    } : {}, agent: false });
    req.on('socket', socket => {
      if (socket.connecting === false && !socket.pending) connected = true;
      socket.once('connect', () => { connected = true; });
    });
    req.on('response', res => {
      response = res; res.on('error', () => {});
      finish({ state: 'answered', status: res.statusCode, headers: res.headers });
    });
    req.on('upgrade', (res, socket) => {
      res.on('error', () => {}); socket.on('error', () => {});
      response = res; upgraded = socket;
      finish({ state: 'answered', status: res.statusCode, headers: res.headers });
    });
    req.on('error', error => finish(DOWN.has(error.code)
      ? { state: 'down', code: error.code }
      : { state: 'error', code: error.code ?? String(error.message ?? error) }));
    if (body) req.write(body);
    req.end();
  } catch (error) { finish({ state: 'error', code: error?.code ?? String(error?.message ?? error) }); }
});

// The parsed target and the option checks that precede the first request: `{ target }` or `{ error }`.
function probeTarget(url, timeoutMs, follow) {
  let target;
  try { target = new URL(url); } catch { return { error: { state: 'error', code: 'URL_INVALID' } }; }
  if (!supported(target)) return { error: { state: 'error', code: 'URL_PROTOCOL' } };
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647)
    return { error: { state: 'error', code: 'TIMEOUT_INVALID' } };
  if (!Number.isSafeInteger(follow) || follow < 0) return { error: { state: 'error', code: 'FOLLOW_INVALID' } };
  return { target };
}

// Where a redirect `location` leads from `target`: `{ target }` or `{ error }`.
function redirectTarget(location, target) {
  let next;
  try { next = new URL(location, target); } catch { return { error: { state: 'error', code: 'REDIRECT_INVALID' } }; }
  if (!supported(next)) return { error: { state: 'error', code: 'REDIRECT_PROTOCOL' } };
  return { target: next };
}

/** answered headers/status/final URL | down (no connection) | hung (connected, no headers) | error. */
export async function probe(url, { method = 'GET', body = null, timeoutMs = 20_000, follow = 20 } = {}) {
  const first = probeTarget(url, timeoutMs, follow);
  if (first.error) return first.error;
  let { target } = first;
  const started = Date.now(), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let hops = 0; ; hops += 1) {
      const r = await once(target, { method, body, signal: controller.signal, started });
      if (r.state !== 'answered') return r;
      const location = r.headers?.location;
      if (!REDIRECT.has(r.status) || !location || hops >= follow)
        return { ...r, ms: Date.now() - started, url: target.toString() };
      const next = redirectTarget(location, target);
      if (next.error) return next.error;
      target = next.target;
      if (r.status !== 307 && r.status !== 308) { method = method === 'HEAD' ? 'HEAD' : 'GET'; body = null; }
    }
  } finally { clearTimeout(timer); }
}
