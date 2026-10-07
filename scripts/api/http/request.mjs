// request.mjs — one outgoing plain-HTTP request whose body the caller streams in and whose response it streams out: the
// ask gateway forwarding a public request to a loopback form server. The target is judged here, against the policy the caller
// declares, before node:http sees it; the answer is never followed to another host (the caller reads the redirect itself).
import { plainHttp } from './lib.mjs';
import { isLoopbackHost } from '../../lib/loopback-host.mjs';

const refuse = (reason) => Object.assign(new Error(`request target refused: ${reason} [URL_TARGET_REFUSED]`), { code: 'URL_TARGET_REFUSED' });

const hostPartOf = (host) => (host.includes(':') && !host.startsWith('[') ? `[${host}]` : host);

/** The printable ASCII characters a request path may carry (everything but space and the URL delimiters " # < >): a table, so every outgoing character is looked up, never copied from the caller. */
const PATH_CHARS = new Map(Array.from({ length: 0x5e }, (_, i) => String.fromCharCode(0x21 + i)).filter((c) => !'"#<>'.includes(c)).map((c) => [c, c]));

/** The request path rebuilt character by character from PATH_CHARS (the first `?` opens the query), or null for a path that is not absolute or holds any other character. */
const pathOf = (value) => {
  const chars = Array.from(String(value ?? '/'), (c) => PATH_CHARS.get(c));
  return chars[0] === '/' && chars.every((c) => c !== undefined) ? chars.join('') : null;
};

/** The loopback host `name` denotes as a policy constant (`localhost`, `[::1]` or an address of 127.0.0.0/8 spelled from its numbers), or null. */
const loopbackHostOf = (name) => {
  if (!isLoopbackHost(name)) return null;
  const bare = name.replace(/^\[|\]$/g, '');
  if (bare === 'localhost') return 'localhost';
  if (bare === '::1') return '[::1]';
  const octets = bare.split('.').map(Number);
  return octets.length === 4 && octets.every((n) => Number.isInteger(n) && n >= 0 && n < 256) ? octets.join('.') : null;
};

/** The policy's own spelling of `name` (a lookup in what the caller declared: the returned string is the policy's, never `name`), or null when the policy does not name it. */
const allowedHostOf = (allow, name) => {
  if (allow === 'loopback') return loopbackHostOf(name);
  const declared = new Map(allow.hosts.map((entry) => [String(entry).toLowerCase(), String(entry).toLowerCase()]));
  return declared.get(name) ?? null;
};

/** The TCP port of `value` as a number (null when none is given), or NaN when it is not a port. */
const portOf = (value) => {
  if (value == null || value === '') return null;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : Number.NaN;
};

/**
 * The node:http ClientRequest of `options` ({host, port, method, path, headers, timeout}); `onResponse(res)` gets the answer.
 * `allow` is required: 'loopback' (this machine only) or {hosts: [name, ...]} (those host names only). A target outside the
 * policy, a non-http protocol, URL credentials, a malformed port or a path outside the allowed characters throws a
 * URL_TARGET_REFUSED error before anything is sent. The URL is built from the policy's host constant, a numeric port and the
 * rebuilt path, then judged again after parsing.
 */
export const request = (options, onResponse, allow) => {
  const name = String(options?.host ?? '').toLowerCase();
  const hosts = allow?.hosts;
  if (allow !== 'loopback' && !(Array.isArray(hosts) && hosts.length)) throw refuse('the caller declared no allow policy');
  if (options.protocol != null && options.protocol !== 'http:') throw refuse(`protocol ${options.protocol} is not http:`);
  if (options.auth != null || /[@/?#\s]/.test(name)) throw refuse('a request target carries no credentials or URL syntax');
  const port = portOf(options.port);
  if (Number.isNaN(port)) throw refuse(`port ${options.port} is not a TCP port`);
  const host = allowedHostOf(allow, name);
  if (host === null) throw refuse(`host ${name || '(none)'} is outside the allowed hosts`);
  const target = pathOf(options.path);
  if (target === null) throw refuse('a request path starts with / and holds only printable ASCII without " # < >');
  let url;
  try { url = new URL(`http://${hostPartOf(host)}${port === null ? '' : `:${port}`}${target}`); }
  catch { throw refuse('the request target is not a URL'); }
  // Only the checked URL object reaches node:http: its protocol and hostname are judged again after parsing.
  if (url.protocol !== 'http:' || url.username || url.password || allowedHostOf(allow, url.hostname) === null) throw refuse(`host ${url.hostname} is outside the allowed hosts`);
  const rest = { ...options };
  for (const key of ['host', 'port', 'path', 'protocol', 'auth']) delete rest[key];
  return plainHttp.request(url, rest, onResponse);
};
