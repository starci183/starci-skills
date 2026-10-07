#!/usr/bin/env node
// ask-gateway.mjs — one local HTTP front for every serve-ask form, so one
// Cloudflare tunnel can publish them all (docs/connectors.md).
//
//   starci connect ask-gateway start     launch detached (records the connectors row 'gateway' in machine.sqlite)
//   starci connect ask-gateway run       run in the foreground
//   starci connect ask-gateway status | stop
//       [--port <n>]   default config.yaml connectors.gateway.port
//       [--repo <path>]...  extra ledger-owner repos beyond connectors.repos
//
// Routing: `/a-<nonce>`, `/a-<nonce>/img/<n>` and `/a-<nonce>/answer` (GET, HEAD, POST) are proxied to
// the loopback form whose latest open `ask-serving` event names that nonce in
// one of the configured repos' ledgers (read-only), or of a repo a Telegram ask
// notice named. Everything else is 404 and is never forwarded, and so is a
// nonce whose serve-ask process has exited: a form is served only while it
// waits (on demand from the Telegram "Generate URL" button, until it is
// answered or its ttl ends). A credential ask (the form asks for custody files
// or env values) is refused with 403 unless connectors.telegram.exposeCredentialAsks
// is true: the owner answers those on the machine through the localhost link.
// Binds 127.0.0.1 only; cloudflared connects from this host.
import '../api/process/hide-child-windows.mjs';
import { serve } from '../api/http/serve.mjs';
import { request } from '../api/http/request.mjs';
import { askUpstreamPath } from './ask-gateway-routes.mjs';
import { fileURLToPath } from 'node:url';
import { configRoot, connectorsConfig } from '../../engine/config.mjs';
import { runtimeSecretEnv } from '../gates/runtime-host.mjs';
import { argsOf, askRepos, claimManager, connectorState, lockHolder, markStarting, NONCE, notifiedRepos, ownerConfig, recordAlive, servingAsksAcross, spawnDetached, startingHolder, writeConnectorState, stopConnector } from './lib.mjs';
import { captureProcessIdentity } from '../api/process/capture-process-identity.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs';
import { isMain } from '../lib/is-main.mjs';

export const GATEWAY_FILE = fileURLToPath(import.meta.url);

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host']);
const MAX_BODY = 1024 * 1024;
const RESOLVE_CACHE_MS = 3000;
// A bearer-nonce page must not leak its URL through Referer, be cached by an
// intermediary, or be indexed.
const PAGE_HEADERS = { 'referrer-policy': 'no-referrer', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff' };

const deny = (res, status, text) => {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...PAGE_HEADERS });
  res.end(text);
};

/**
 * The resolver the gateway asks: nonce -> {url, credential} or null. Cached briefly so one page's
 * asset requests do not reopen every ledger.
 */
export function ledgerResolver({ repos, now = Date.now } = {}) {
  let cache = { at: -Infinity, map: new Map() };
  return (nonce) => {
    if (now() - cache.at > RESOLVE_CACHE_MS) {
      const map = new Map();
      for (const ask of servingAsksAcross(repos(), { now: now() })) if (!map.has(ask.nonce)) map.set(ask.nonce, ask);
      cache = { at: now(), map };
    }
    return cache.map.get(nonce) ?? null;
  };
}

/**
 * The gateway request handler. `resolve(nonce)` returns the open ask ({url, credential}) or null;
 * `exposeCredentialAsks()` is read per request so a config change needs no restart.
 */
export function createGateway({ resolve, exposeCredentialAsks = () => false, language = () => 'en' } = {}) {
  return serve((req, res) => {
    const t = { notFound: 'not found', credential: 'This question asks for credentials, so it is not served over the public link. Answer it on the machine through the localhost link.', upstream: 'The form for this question is not answering right now.' };
    const tr = translator(language());
    for (const key of Object.keys(t)) t[key] = tr(t[key]);
    // A dot segment could walk from one nonce to another; such a path is refused before it is normalized.
    if (/(?:^|\/)(?:\.|%2e){1,2}(?:[/?#]|$)/i.test(req.url ?? '')) return deny(res, 404, t.notFound);
    let pathname;
    try { ({ pathname } = new URL(req.url ?? '/', 'https://gateway.invalid')); } catch { return deny(res, 404, t.notFound); }
    const nonce = pathname.split('/')[1] ?? '';
    if (!NONCE.test(nonce) || (pathname !== `/${nonce}` && !pathname.startsWith(`/${nonce}/`)) ) return deny(res, 404, t.notFound);
    // The form's own routes only: the path sent upstream is built from the route table, never copied from the caller.
    const upstreamPath = askUpstreamPath(pathname);
    if (upstreamPath === null) return deny(res, 404, t.notFound);
    const ask = resolve(nonce);
    if (!ask) return deny(res, 404, t.notFound);
    if (!['GET', 'HEAD', 'POST'].includes(req.method)) return deny(res, 405, 'method not allowed');
    if (ask.credential && !exposeCredentialAsks()) return deny(res, 403, t.credential);
    const target = new URL(ask.url);
    const length = Number(req.headers['content-length'] ?? 0);
    if (length > MAX_BODY) return deny(res, 413, 'too large');
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) if (!HOP_BY_HOP.has(key)) headers[key] = value;
    headers.host = target.host;
    let upstream; try { upstream = request({ host: target.hostname, port: target.port, method: req.method, path: upstreamPath, headers, timeout: 30000 }, (up) => {
      const out = { ...PAGE_HEADERS };
      for (const [key, value] of Object.entries(up.headers)) if (!HOP_BY_HOP.has(key)) out[key] = value;
      // A redirect to the form's own loopback origin becomes a path on the public host.
      if (typeof out.location === 'string') {
        try { const loc = new URL(out.location, target); if (loc.origin === target.origin) out.location = `${loc.pathname}${loc.search}`; } catch { /* leave as is */ }
      }
      res.writeHead(up.statusCode ?? 502, out);
      up.pipe(res);
    }, 'loopback'); } catch { return deny(res, 502, t.upstream); }
    upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
    upstream.on('error', () => { if (!res.headersSent) deny(res, 502, t.upstream); else res.destroy(); });
    let seen = 0;
    req.on('data', (chunk) => { seen += chunk.length; if (seen > MAX_BODY) { upstream.destroy(); req.destroy(); } });
    req.pipe(upstream);
  });
}

/** The gateway's connectors row ({pid, port, startedAt, state, ...}), or null. */
export const gatewayState = (env = process.env) => connectorState('gateway', env);
// Alive: the gateway row names a live process of this boot, a gateway holds the host lock, or a
// starter launched one moments ago that has not claimed it yet.
export const gatewayAlive = (env = process.env) => recordAlive(gatewayState(env)) || Boolean(lockHolder('gateway', env)) || Boolean(startingHolder('gateway', env));

const settings = (args, env = process.env, root = configRoot, config = undefined) => {
  if (config === undefined) config = ownerConfig();
  let connectors = null;
  try { connectors = connectorsConfig(config ?? undefined, env, root); } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exit(2); }
  const extra = [args.repo ?? []].flat().filter((r) => typeof r === 'string');
  const port = Number(args.port ?? connectors.gateway.port);
  return { connectors, config, extra, port };
};

async function run(args, { env, root, config }) {
  const { extra, port } = settings(args, env, root, config);
  // One gateway per host: concurrent `start` calls each launch a `run`; only the one that claims
  // the host lock 'gateway' (and finds no other live gateway in its connectors row) serves.
  const claim = claimManager('gateway', { current: gatewayState(env), env });
  if (!claim.ok) {
    console.log(JSON.stringify({ ok: false, already: true, error: 'another ask gateway owns the gateway state', pid: claim.holder?.pid ?? null }));
    process.exit(1);
  }
  process.on('exit', () => { try { writeConnectorState('gateway', { state: 'stopped' }, env); } catch { /* the store is gone */ } claim.release(); });
  const live = () => { try { return connectorsConfig(config === undefined ? ownerConfig() ?? undefined : config, env, root); } catch { return null; } };
  const server = createGateway({
    // The configured repos plus every repo a Telegram ask notice named (a kernel's `starci kernel serve-ask`
    // notifies from its own repo).
    resolve: ledgerResolver({ repos: () => askRepos(live(), { extra: [...extra, ...notifiedRepos()] }) }),
    exposeCredentialAsks: () => live()?.telegram?.exposeCredentialAsks === true,
    language: () => ownerLanguage(),
  });
  server.on('error', (error) => { console.error(JSON.stringify({ ok: false, error: `gateway cannot listen on 127.0.0.1:${port}: ${error.code ?? error.message}` })); process.exit(1); });
  server.listen(port, '127.0.0.1', () => {
    const startedAt = new Date().toISOString(), bound = server.address()?.port ?? port;
    const captured = captureProcessIdentity(process.pid);
    writeConnectorState('gateway', { kind: 'ask-gateway', state: 'running', pid: process.pid, port: bound, config: { schema: 'starci/ask-gateway@1', pid: process.pid, port: bound, startedAt, source: GATEWAY_FILE,
      processIdentity: captured.ok ? captured.identity : null, processCapture: captured } }, env);
    console.log(JSON.stringify({ ok: true, gateway: `http://127.0.0.1:${port}`, pid: process.pid, repos: askRepos(live(), { extra }) }));
  });
  const stop = () => { server.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

export function main(argv = process.argv.slice(2), { env = process.env, root = configRoot, config = undefined } = {}) {
  const args = argsOf(argv);
  const verb = args._[0] ?? 'run';
  const state = gatewayState(env);
  if (verb === 'status') { console.log(JSON.stringify({ ok: true, running: gatewayAlive(env), ...state })); return; }
  if (verb === 'stop') {
    const result = stopConnector('gateway', { source: GATEWAY_FILE, env });
    console.log(JSON.stringify(result));
    if (!result.ok) { process.exitCode = 1; }
    return result;
  }
  if (verb === 'start') {
    if (gatewayAlive(env)) { console.log(JSON.stringify({ ok: true, already: true, ...state })); return; }
    env = runtimeSecretEnv(env, root);
    const { port } = settings(args, env, root, config);
    const pass = [args.repo ?? []].flat().filter((r) => typeof r === 'string').flatMap((r) => ['--repo', r]);
    const pid = spawnDetached(GATEWAY_FILE, ['run', '--port', String(port), ...pass], { env });
    markStarting('gateway', pid, env);
    console.log(JSON.stringify({ ok: true, launched: pid, gateway: `http://127.0.0.1:${port}` })); return;
  }
  if (verb === 'run') return run(args, { env: runtimeSecretEnv(env, root), root, config });
  console.error('usage: starci connect ask-gateway start|run|status|stop [--port <n>] [--repo <path>]...'); process.exit(2);
}

if (isMain(import.meta.url)) {
  const result = main();
  if (result && typeof result.then === 'function') {
    try { await result; } catch (error) { console.error(error); process.exit(1); }
  }
}
