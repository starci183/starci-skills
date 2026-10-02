// request.mjs — one outgoing plain-HTTP request whose body the caller streams in and whose response it streams out: the
// ask gateway forwarding a public request to a loopback form server.
import { plainHttp } from './lib.mjs';

/** The node:http ClientRequest of `options` ({host, port, method, path, headers, timeout}); `onResponse(res)` gets the answer. */
export const request = (options, onResponse) => plainHttp.request(options, onResponse);
