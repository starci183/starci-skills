import { serve } from '../scripts/api/http/serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { uiDeliveryReadiness } from '../scripts/machine/ui-delivery.mjs';
export { uiDeliveryReadiness };
import { createApiHandler } from './api/index.mjs';
import { sendJson } from './api/envelope.mjs';
import { appPort } from './ports.mjs';
import { readEnv } from '../scripts/lib/env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.woff2':'font/woff2' };

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
