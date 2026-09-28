import { etagOf } from './etag.mjs';
import { publicJson } from './redact-read.mjs';

export function sendJson(request, response, data, { status = 200, sources = [], stale = [], next = null, marks = [], cache = 'no-cache' } = {}) {
  const clean = publicJson(data);
  const at = Date.now();
  const etag = etagOf(marks, clean);
  const body = JSON.stringify({ data: clean, meta: { at, etag, sources, stale, next } });
  response.setHeader('Cache-Control', cache);
  response.setHeader('ETag', etag);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.headers['if-none-match'] === etag) { response.writeHead(304); response.end(); return; }
  response.writeHead(status);
  response.end(request.method === 'HEAD' ? undefined : body);
}

export function sendError(request, response, status, code, message) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ error: { code, message } }));
}
