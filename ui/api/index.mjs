import { openUiDb } from './db.mjs';
import { createRateLimit } from './rate-limit.mjs';
import { sendError } from './envelope.mjs';
import { healthz, contract, search } from './routes/meta.mjs';
import { blob } from './routes/blob.mjs';
import { initializeReadRedaction } from './redact-read.mjs';
import { handleWork } from './routes/work.mjs';
import { handleAttempt } from './routes/attempt.mjs';
import { handleDecisions } from './routes/decisions.mjs';
import { handleSystem } from './routes/system.mjs';

export function createApiHandler({ handlers = [handleWork, handleAttempt, handleDecisions, handleSystem], env = process.env } = {}) {
  const store = openUiDb({ env });
  initializeReadRedaction(store.projects());
  const permit = createRateLimit();

  async function handle(request, response, url) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      sendError(request, response, 405, 'METHOD_NOT_ALLOWED', 'Only GET and HEAD are supported');
      return true;
    }
    const pathname = url.pathname;
    const isBlob = pathname.startsWith('/api/blob/');
    if (!permit(request, { blob: isBlob })) {
      sendError(request, response, 429, 'RATE_LIMITED', 'Rate limit exceeded');
      return true;
    }
    if (pathname === '/healthz') { healthz(request, response, store); return true; }
    if (pathname === '/api/contract') { contract(request, response, store); return true; }
    if (pathname === '/api/search') { search(request, response, store, url); return true; }
    if (isBlob) { await blob(request, response, store, url, pathname.slice('/api/blob/'.length)); return true; }
    for (const handler of handlers) {
      if (await handler(request, response, store, url)) return true;
    }
    if (pathname.startsWith('/api/')) {
      sendError(request, response, 404, 'NOT_FOUND', 'Route not found');
      return true;
    }
    return false;
  }

  return { handle, close: () => store.close(), store };
}
