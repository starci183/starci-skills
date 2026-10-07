// request.mjs — one outgoing plain-HTTP request whose body the caller streams in and whose response it streams out: the
// ask gateway forwarding a public request to a loopback form server. The target is judged here, against the policy the caller
// declares, before node:http sees it; the answer is never followed to another host (the caller reads the redirect itself).
import { plainHttp } from './lib.mjs';
import { isLoopbackHost } from '../../lib/loopback-host.mjs';

const refuse = (reason) => Object.assign(new Error(`request target refused: ${reason} [URL_TARGET_REFUSED]`), { code: 'URL_TARGET_REFUSED' });

const invalidPort = (port) => port != null && port !== '' && !(Number.isInteger(Number(port)) && Number(port) > 0 && Number(port) < 65536);
const hostPartOf = (host) => (host.includes(':') && !host.startsWith('[') ? `[${host}]` : host);
const portPartOf = (port) => (port == null || port === '' ? '' : `:${Number(port)}`);

/**
 * The node:http ClientRequest of `options` ({host, port, method, path, headers, timeout}); `onResponse(res)` gets the answer.
 * `allow` is required: 'loopback' (this machine only) or {hosts: [name, ...]} (those host names only). A target outside the
 * policy, a non-http protocol, URL credentials or a malformed port throws a URL_TARGET_REFUSED error before anything is sent.
 */
export const request = (options, onResponse, allow) => {
  const host = String(options?.host ?? '').toLowerCase();
  const hosts = allow?.hosts;
  if (allow !== 'loopback' && !(Array.isArray(hosts) && hosts.length)) throw refuse('the caller declared no allow policy');
  if (options.protocol != null && options.protocol !== 'http:') throw refuse(`protocol ${options.protocol} is not http:`);
  if (options.auth != null || /[@/?#\s]/.test(host)) throw refuse('a request target carries no credentials or URL syntax');
  if (invalidPort(options.port)) throw refuse(`port ${options.port} is not a TCP port`);
  const permitted = (name) => (allow === 'loopback' ? isLoopbackHost(name) : hosts.some((entry) => String(entry).toLowerCase() === name));
  if (!permitted(host)) throw refuse(`host ${host || '(none)'} is outside the allowed hosts`);
  const target = String(options.path ?? '/');
  if (!target.startsWith('/')) throw refuse('a request path starts with /');
  let url;
  try { url = new URL(`http://${hostPartOf(host)}${portPartOf(options.port)}${target}`); }
  catch { throw refuse('the request target is not a URL'); }
  // Only the checked URL object reaches node:http: its protocol and hostname are judged again after parsing.
  if (url.protocol !== 'http:' || url.username || url.password || !permitted(url.hostname)) throw refuse(`host ${url.hostname} is outside the allowed hosts`);
  const rest = { ...options };
  for (const key of ['host', 'port', 'path', 'protocol', 'auth']) delete rest[key];
  return plainHttp.request(url, rest, onResponse);
};
