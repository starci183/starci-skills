import { serve } from '../scripts/api/http/serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs, { createReadStream, existsSync, statSync } from 'node:fs';
import { createApiHandler } from './api/index.mjs';
import { sendJson } from './api/envelope.mjs';
import { appPort } from './ports.mjs';
import { readEnv } from '../scripts/lib/env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.woff2':'font/woff2' };

export function uiDeliveryReadiness({ distDir = dist, fsImpl = fs } = {}) {
  const root = path.resolve(distDir);
  const file = (relative) => {
    const target = path.resolve(root, relative);
    return target.startsWith(root + path.sep) && fsImpl.statSync(target).isFile();
  };
  try {
    if (!file('index.html')) return { ok: false, reason: 'index unavailable' };
    const html = fsImpl.readFileSync(path.join(root, 'index.html'), 'utf8');
    const attribute = (tag, name) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1] ?? null;
    const missing = [], assets = [], modules = [];
    for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
      const tag = match[0], kind = match[1].toLowerCase();
      const module = kind === 'script' && attribute(tag, 'type') === 'module';
      const style = kind === 'link' && String(attribute(tag, 'rel')).split(/\s+/).includes('stylesheet');
      if (!module && !style) continue;
      const value = attribute(tag, module ? 'src' : 'href');
      if (!value) { if (module) missing.push('module-source'); continue; }
      const url = new URL(value, 'http://localhost/');
      if (url.origin !== 'http://localhost') { if (module) missing.push('external-module'); continue; }
      const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
      assets.push(relative);
      if (module) modules.push(relative);
      try { if (!file(relative)) missing.push(relative); } catch { missing.push(relative); }
    }
    if (!modules.length) missing.push('module-entry');
    return { ok: missing.length === 0, assets, missing };
  } catch { return { ok: false, reason: 'delivery unavailable' }; }
}

function serveStatic(request,response,url,distDir) {
  const relative = url.pathname === '/' || !path.extname(url.pathname) ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const target = path.resolve(distDir,relative);
  if (!target.startsWith(distDir + path.sep)) {
    response.writeHead(404); response.end(); return;
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404); response.end(); return;
  }
  response.writeHead(200, {
    'Content-Type':mime[path.extname(target)] || 'application/octet-stream',
    'Cache-Control':relative === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
  });
  if (request.method === 'HEAD') { response.end(); return; }
  createReadStream(target).on('error',()=>response.destroy()).pipe(response);
}

/** Start the built harness UI and API in the caller's process; the caller owns signals and logging. */
export function startHarnessServer({ port = null, env = process.env, distDir = dist } = {}) {
  const selectedPort = Number(port ?? (readEnv('STARCI_STATUS_PORT', env) || appPort));
  const api = createApiHandler({ env });
  const server = serve(async (request,response) => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      response.setHeader('X-Content-Type-Options','nosniff');
      response.setHeader('Referrer-Policy','no-referrer');
      if (url.pathname === '/healthz') {
        const delivery = uiDeliveryReadiness({ distDir });
        if (!delivery.ok) { sendJson(request, response, { ok: false, ui: delivery }, { status: 503, cache: 'no-store' }); return; }
      }
      if (await api.handle(request,response,url)) return;
      serveStatic(request,response,url,path.resolve(distDir));
    } catch {
      if (!response.headersSent) response.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      response.end(request.method === 'HEAD' ? undefined : '{"error":{"code":"INTERNAL","message":"Request failed"}}');
    }
  });
  server.listen(selectedPort,'127.0.0.1');
  let closed = false;
  const close = () => new Promise((resolve) => {
    if (closed) { resolve(); return; }
    closed = true;
    try { api.close(); } catch { /* best-effort teardown continues with the listener */ }
    try { server.close(() => resolve()); } catch { resolve(); }
  });
  return { server, close };
}
