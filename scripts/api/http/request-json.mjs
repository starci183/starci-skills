// Bounded provider JSON transport; successful data is private to the owning adapter.
import { transportOf } from './lib.mjs';
import { isLoopbackHost } from '../../lib/loopback-host.mjs';

const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
const READ = new Set(['GET', 'HEAD']);
const HEADERS = new Set(['accept', 'authorization', 'content-type', 'apikey', 'x-client-info']);
const result = (code, status = null, effect = 'none') => ({ ok: false, status, data: null, code, effect });

function requestTarget(input, policy) {
  const origin = new URL(input.origin);
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash)
    throw new Error('origin');
  if (origin.protocol !== 'https:' && !(policy.allowHttpLoopback === true && origin.protocol === 'http:' && isLoopbackHost(origin.hostname)))
    throw new Error('protocol');
  if (!Array.isArray(policy.allowedOrigins) || !policy.allowedOrigins.includes(origin.origin)) throw new Error('origin');
  if (typeof input.path !== 'string' || !input.path.startsWith('/') || input.path.startsWith('//') || /[\r\n\\#]/u.test(input.path))
    throw new Error('path');
  const target = new URL(input.path, origin);
  if (target.origin !== origin.origin || target.username || target.password || target.hash) throw new Error('target');
  return target;
}

function requestBody(value) {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') return Buffer.from(value);
  return Buffer.from(JSON.stringify(value));
}

/**
 * Make one request to an adapter's exact declared origin. Redirects, raw failure bodies and
 * ambient proxy configuration are never consumed. Successful JSON remains private to the adapter.
 * A failed write after launch is unknown; this function never retries an external effect.
 */
export async function requestJson(input, policy = {}) {
  if (!input || typeof input !== 'object' || !policy || typeof policy !== 'object') return result('request-policy-invalid');
  const method = input.method ?? 'GET';
  const timeoutMs = input.timeoutMs ?? 30_000;
  const maxBytes = input.maxBytes ?? 1024 * 1024;
  let target, body, headers;
  try {
    if (!METHODS.has(method) || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000
      || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 16 * 1024 * 1024) return result('request-policy-invalid');
    target = requestTarget(input, policy);
    headers = { accept: 'application/json' };
    const seen = new Set();
    for (const [name, value] of Object.entries(input.headers ?? {})) {
      const lower = name.toLowerCase();
      if (!HEADERS.has(lower) || seen.has(lower) || typeof value !== 'string' || /[\r\n]/u.test(value))
        return result('request-header-refused');
      seen.add(lower); headers[lower] = value;
    }
    body = requestBody(input.body);
    if (body?.length > maxBytes) return result('request-body-limit');
  } catch { return result('request-target-refused'); }
  return new Promise(resolve => {
    let request, response, timer, settled = false;
    const mutationEffect = READ.has(method) ? 'none' : 'unknown';
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      response?.destroy();
      request?.destroy();
      resolve(value);
    };
    try {
      if (body) {
        if (!Object.keys(headers).some(name => name.toLowerCase() === 'content-type')) headers['content-type'] = 'application/json';
        headers['content-length'] = String(body.length);
      }
      // A private authorization header can reach only the selected origin, never a redirect.
      request = transportOf(target).request(target, { method, headers, agent: false, rejectUnauthorized: true }, incoming => {
        response = incoming;
        const status = incoming.statusCode ?? null;
        incoming.on('error', () => finish(result('response-interrupted', status, mutationEffect)));
        incoming.on('aborted', () => finish(result('response-interrupted', status, mutationEffect)));
        if (status >= 300 && status < 400) { finish(result('response-redirect-refused', status, mutationEffect)); return; }
        if (status === null || status < 200 || status >= 300) {
          finish(result('provider-http-failure', status, mutationEffect)); return;
        }
        const chunks = [];
        let length = 0;
        incoming.on('data', chunk => {
          length += chunk.length;
          if (length > maxBytes) finish(result('response-body-limit', status, mutationEffect));
          else chunks.push(chunk);
        });
        incoming.on('end', () => {
          if (settled) return;
          try {
            const data = length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
            finish({ ok: true, status, data, code: 'provider-response', effect: READ.has(method) ? 'none' : 'acknowledged' });
          } catch { finish(result('response-json-invalid', status, mutationEffect)); }
        });
      });
      request.on('error', () => finish(result('request-transport-failure', null, mutationEffect)));
      timer = setTimeout(() => finish(result('request-deadline', response?.statusCode ?? null, mutationEffect)), timeoutMs);
      request.end(body);
    } catch { finish(result('request-launch-failure', null, mutationEffect)); }
  });
}
