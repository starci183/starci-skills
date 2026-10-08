// fresh-fetch.mjs — a request to the SonarQube server that opens a connection of its own. The release proof runs synchronous steps (installs, lint) that block the process for minutes between two
// reads of the server; a keep-alive socket pooled before such a pause is reset by the docker port proxy meanwhile, and its reuse fails the next request with ECONNRESET although the server is UP.

/** `fetch(url, init)` with `Connection: close`; the Response, or the rejection of the request. */
export const freshFetch = (url, init = {}) => globalThis.fetch(url, { ...init, headers: { ...init.headers, Connection: 'close' } });
