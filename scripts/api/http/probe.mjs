// probe.mjs — one HTTP probe of a URL that tells refused from hung: the health check of a dev server (uat/env-health),
// an engine endpoint (reconciler/core-watch), an ask form (supervisor/poll) or the connectors' gateway (connectors/tunnel).
// `follow` is how many redirects it follows, as fetch would (default 20, fetch's own limit): a 301/302/303 is re-asked as
// a GET without the body, a 307/308 with the same method and body; `follow: 0` answers the redirect itself (a caller
// that judges the redirect, as fetch's redirect:'manual'). One timeoutMs bounds the whole chain. Never throws.
import { transportOf } from './lib.mjs';

const REDIRECT = new Set([301, 302, 303, 307, 308]);
const DOWN = new Set(['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND', 'EADDRNOTAVAIL']);

/** One request: {state:'answered', status, headers} | {state:'down'|'hung'|'error', ...}. */
const once = (target, { method, body, timeoutMs, started }) => new Promise((resolve) => {
  let connected = false, done = false;
  const finish = (value) => { if (!done) { done = true; resolve(value); } };
  let req;
  try {
    req = transportOf(target).request(target, { method, headers: body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}, agent: false });
  } catch (error) { finish({ state: 'error', code: error?.code ?? String(error?.message ?? error) }); return; }
  req.on('socket', (socket) => {
    if (socket.connecting === false && !socket.pending) connected = true;
    socket.on('connect', () => { connected = true; });
  });
  req.setTimeout(Math.max(1, timeoutMs), () => {
    finish(connected ? { state: 'hung', ms: Date.now() - started } : { state: 'down', code: 'CONNECT_TIMEOUT', ms: Date.now() - started });
    req.destroy();
  });
  req.on('response', (res) => { res.resume(); finish({ state: 'answered', status: res.statusCode, headers: res.headers }); });
  req.on('error', (error) => finish(DOWN.has(error.code) ? { state: 'down', code: error.code } : { state: 'error', code: error.code ?? String(error.message ?? error) }));
  if (body) req.write(body);
  req.end();
});

/**
 * Promise of {state:'answered', status, headers, ms, url} (url: the URL that answered, after redirects) |
 * {state:'down', code, ms?} | {state:'hung', ms} (TCP connected, no answer in time) | {state:'error', code}.
 */
export async function probe(url, { method = 'GET', body = null, timeoutMs = 20_000, follow = 20 } = {}) {
  let target;
  try { target = new URL(url); } catch { return { state: 'error', code: 'URL_INVALID' }; }
  const started = Date.now();
  for (let hops = 0; ; hops += 1) {
    const r = await once(target, { method, body, timeoutMs: timeoutMs - (Date.now() - started), started });
    if (r.state !== 'answered') return r;
    const location = r.headers?.location;
    if (!REDIRECT.has(r.status) || !location || hops >= follow) return { ...r, ms: Date.now() - started, url: target.toString() };
    try { target = new URL(location, target); } catch { return { state: 'error', code: 'REDIRECT_INVALID' }; }
    if (r.status !== 307 && r.status !== 308) { method = method === 'HEAD' ? 'HEAD' : 'GET'; body = null; }
  }
}
