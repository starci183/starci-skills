import { openUiDb } from './db.mjs';
import { sendError } from './envelope.mjs';
import { healthz, contract, search } from './routes/meta.mjs';
import { blob } from './routes/blob.mjs';
import { initializeReadRedaction } from './redact-read.mjs';
import { handleWork } from './routes/work.mjs';
import { handleAttempt } from './routes/attempt.mjs';
import { handleDecisions } from './routes/decisions.mjs';
import { handleSystem } from './routes/system.mjs';
import { handleLogs } from './routes/logs.mjs';
import { handleLive } from './routes/live.mjs';
import { handleHost } from './routes/host.mjs';
import { bindProvenance } from './provenance.mjs';
import { ReadCursorError } from './query.mjs';
import { findInOrder } from '../../scripts/lib/in-order.mjs';

export function createApiHandler({ handlers = [handleWork, handleAttempt, handleDecisions, handleSystem, handleLogs, handleLive, handleHost], env = process.env } = {}) {
  const store = openUiDb({ env });
  initializeReadRedaction(store.projects());

  async function handle(request, response, url) {
    const scope = store.request();
    bindProvenance(request, scope);
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      sendError(request, response, 405, 'METHOD_NOT_ALLOWED', 'Only GET and HEAD are supported');
      return true;
    }
    const pathname = url.pathname;
    if (pathname !== '/healthz' && !pathname.startsWith('/api/')) return false;
    try {
      const isBlob = pathname.startsWith('/api/blob/');
      if (pathname === '/healthz') { healthz(request, response, scope); return true; }
      if (pathname === '/api/contract') { contract(request, response, scope); return true; }
      if (pathname === '/api/search') { search(request, response, scope, url); return true; }
      if (isBlob) { await blob(request, response, scope, url, pathname.slice('/api/blob/'.length)); return true; }
      if (await findInOrder(handlers, (handler) => handler(request, response, scope, url))) return true;
    } catch (error) {
      if (error instanceof ReadCursorError) sendError(request, response, 400, 'BAD_CURSOR', 'Cursor does not match this query');
      else { scope.failSource('api', url.pathname); sendError(request, response, 503, 'READ_FAILED', 'Source read unavailable'); }
      return true;
    }
    if (pathname.startsWith('/api/')) {
      sendError(request, response, 404, 'NOT_FOUND', 'Route not found');
      return true;
    }
    return false;
  }

  return { handle, close: () => store.close(), store };
}
