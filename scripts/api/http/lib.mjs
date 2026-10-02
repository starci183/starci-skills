// scripts/api/http/lib.mjs — the runner of the runtime's own HTTP traffic: the node:http / node:https transport of a URL.
// The call files beside it (probe.mjs, serve.mjs, request.mjs) each name one use: a health probe of an origin, a local
// server an entry or a connector runs, one proxied request. Nothing outside scripts/api/http imports this runner.
import http from 'node:http';
import https from 'node:https';

/** node:https for an https: URL, node:http for anything else. */
export const transportOf = (url) => (url?.protocol === 'https:' ? https : http);

/** The plain-HTTP transport (local servers and loopback requests). */
export const plainHttp = http;
