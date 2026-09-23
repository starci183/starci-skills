#!/usr/bin/env node
// ask-gateway.mjs — one local HTTP front for every serve-ask form, so one
// Cloudflare tunnel can publish them all (docs/connectors.md).
//
//   node scripts/connectors/ask-gateway.mjs start     launch detached (records gateway.json)
//   node scripts/connectors/ask-gateway.mjs run       run in the foreground
//   node scripts/connectors/ask-gateway.mjs status | stop
//       [--port <n>]   default config.yaml connectors.gateway.port
//       [--repo <path>]...  extra ledger-owner repos beyond connectors.repos
//
// Routing: `/a-<nonce>` and `/a-<nonce>/...` (GET, HEAD, POST) are proxied to
// the loopback form whose latest open `ask-serving` event names that nonce in
// one of the configured repos' ledgers (read-only). Everything else is 404 and
// is never forwarded. A credential ask (the form asks for custody files or env
// values) is refused with 403 unless connectors.telegram.exposeCredentialAsks
// is true: the owner answers those on the machine through the localhost link.
// Binds 127.0.0.1 only; cloudflared connects from this host.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectorsConfig } from '../../engine/config.mjs';
import { argsOf, askRepos, NONCE, ownerConfig, pidAlive, readJson, servingAsksAcross, spawnDetached, stateFile, writeJson } from './lib.mjs';

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host']);
const MAX_BODY = 1024 * 1024;
const RESOLVE_CACHE_MS = 3000;
// A bearer-nonce page must not leak its URL through Referer, be cached by an
// intermediary, or be indexed.
const PAGE_HEADERS = { 'referrer-policy': 'no-referrer', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff' };

const TEXT = {
  en: { notFound: 'not found', credential: 'This question asks for credentials, so it is not served over the public link. Answer it on the machine through the localhost link.', upstream: 'The form for this question is not answering right now.' },
  vi: { notFound: 'không tìm thấy', credential: 'Câu hỏi này cần thông tin bí mật nên không mở qua link công khai. Hãy trả lời trên máy bằng link localhost.', upstream: 'Form của câu hỏi này hiện không phản hồi.' },
};

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
  return http.createServer((req, res) => {
    const t = TEXT[language()] ?? TEXT.en;
    // A dot segment could walk from one nonce to another; such a path is refused before it is normalized.
    if (/(?:^|\/)(?:\.|%2e){1,2}(?:[/?#]|$)/i.test(req.url ?? '')) return deny(res, 404, t.notFound);
    let pathname, search;
    try { ({ pathname, search } = new URL(req.url ?? '/', 'http://gateway.invalid')); } catch { return deny(res, 404, t.notFound); }
    const nonce = pathname.split('/')[1] ?? '';
    if (!NONCE.test(nonce) || (pathname !== `/${nonce}` && !pathname.startsWith(`/${nonce}/`)) ) return deny(res, 404, t.notFound);
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
    const upstream = http.request({ host: target.hostname, port: target.port, method: req.method, path: `${pathname}${search}`, headers, timeout: 30000 }, (up) => {
      const out = { ...PAGE_HEADERS };
      for (const [key, value] of Object.entries(up.headers)) if (!HOP_BY_HOP.has(key)) out[key] = value;
      // A redirect to the form's own loopback origin becomes a path on the public host.
      if (typeof out.location === 'string') {
        try { const loc = new URL(out.location, target); if (loc.origin === target.origin) out.location = `${loc.pathname}${loc.search}`; } catch { /* leave as is */ }
      }
      res.writeHead(up.statusCode ?? 502, out);
      up.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
    upstream.on('error', () => { if (!res.headersSent) deny(res, 502, t.upstream); else res.destroy(); });
    let seen = 0;
    req.on('data', (chunk) => { seen += chunk.length; if (seen > MAX_BODY) { upstream.destroy(); req.destroy(); } });
    req.pipe(upstream);
  });
}

export const gatewayState = (env = process.env) => readJson(stateFile('gateway.json', env));
export const gatewayAlive = (env = process.env) => { const s = gatewayState(env); return Boolean(s?.pid && pidAlive(s.pid)); };

const settings = (args) => {
  const config = ownerConfig();
  let connectors = null;
  try { connectors = connectorsConfig(config ?? undefined); } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exit(2); }
  const extra = [args.repo ?? []].flat().filter((r) => typeof r === 'string');
  const port = Number(args.port ?? connectors.gateway.port);
  return { connectors, config, extra, port };
};

async function run(args) {
  const { extra, port } = settings(args);
  const live = () => { try { return connectorsConfig(ownerConfig() ?? undefined); } catch { return null; } };
  const server = createGateway({
    resolve: ledgerResolver({ repos: () => askRepos(live(), { extra }) }),
    exposeCredentialAsks: () => live()?.telegram?.exposeCredentialAsks === true,
    language: () => ownerConfig()?.language ?? 'en',
  });
  server.on('error', (error) => { console.error(JSON.stringify({ ok: false, error: `gateway cannot listen on 127.0.0.1:${port}: ${error.code ?? error.message}` })); process.exit(1); });
  server.listen(port, '127.0.0.1', () => {
    writeJson(stateFile('gateway.json'), { schema: 'starci/ask-gateway@1', pid: process.pid, port, startedAt: new Date().toISOString() });
    console.log(JSON.stringify({ ok: true, gateway: `http://127.0.0.1:${port}`, pid: process.pid, repos: askRepos(live(), { extra }) }));
  });
  const stop = () => { server.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

function main() {
  const args = argsOf(process.argv.slice(2));
  const verb = args._[0] ?? 'run';
  const state = gatewayState();
  if (verb === 'status') { console.log(JSON.stringify({ ok: true, running: gatewayAlive(), ...(state ?? {}) })); return; }
  if (verb === 'stop') {
    if (state?.pid && pidAlive(state.pid)) { try { process.kill(state.pid); } catch { /* gone */ } }
    console.log(JSON.stringify({ ok: true, stopped: state?.pid ?? null })); return;
  }
  if (verb === 'start') {
    if (gatewayAlive()) { console.log(JSON.stringify({ ok: true, already: true, ...state })); return; }
    const { port } = settings(args);
    const pass = [].concat(args.repo ?? []).filter((r) => typeof r === 'string').flatMap((r) => ['--repo', r]);
    const pid = spawnDetached(fileURLToPath(import.meta.url), ['run', '--port', String(port), ...pass]);
    console.log(JSON.stringify({ ok: true, launched: pid, gateway: `http://127.0.0.1:${port}` })); return;
  }
  if (verb === 'run') return run(args);
  console.error('usage: ask-gateway.mjs start|run|status|stop [--port <n>] [--repo <path>]...'); process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
