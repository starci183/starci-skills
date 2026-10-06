// request.mjs — one outgoing plain-HTTP request whose body the caller streams in and whose response it streams out: the
// ask gateway forwarding a public request to a loopback form server. The target is judged here, against the policy the caller
// declares, before node:http sees it; the answer is never followed to another host (the caller reads the redirect itself).
import { plainHttp } from './lib.mjs';
import { isLoopbackHost } from '../../lib/loopback-host.mjs';

const refuse = (reason) => Object.assign(new Error(`request target refused: ${reason} [URL_TARGET_REFUSED]`), { code: 'URL_TARGET_REFUSED' });

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
  if (options.auth != null || /[@/\?#\s]/.test(host)) throw refuse('a request target carries no credentials or URL syntax');
  if (options.port != null && options.port !== '' && !(Number.isInteger(Number(options.port)) && Number(options.port) > 0 && Number(options.port) < 65536)) throw refuse(`port ${options.port} is not a TCP port`);
  if (allow === 'loopback' ? !isLoopbackHost(host) : !hosts.some((name) => String(name).toLowerCase() === host)) throw refuse(`host ${host || '(none)'} is outside the allowed hosts`);
  return plainHttp.request(options, onResponse);
};
