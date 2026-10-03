// query.mjs — the read prelude the api routes share (routes/*.mjs): `source` tuples for the envelope's sources
// list, the `many`/`one` sql readers, a forgiving `parse` of a json column, the store's `stale` list, and the
// `?limit`/`?cursor` paging. Cursors bind route/filter identity and a native row anchor;
// this is not a cross-database snapshot. `limit` is capped at 200, default 50.
import { createHash } from 'node:crypto';
export const source = (db, ...rels) => rels.map(rel => ({ db, rel }));
export const many = (db, sql, ...args) => db.prepare(sql).all(...args);
export const one = (db, sql, ...args) => db.prepare(sql).get(...args) ?? null;
export const parse = (value, fallback = null) => { try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; } };
export const staleOf = store => [...store.stale];
export const limitOf = url => Math.min(200, Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || 50)));
export class ReadCursorError extends Error {
  constructor(message = 'The page cursor does not match this read. Refresh the first page.') { super(message); this.name = 'ReadCursorError'; this.status = 400; this.code = 'BAD_CURSOR'; }
}
export const cursorScope = url => createHash('sha256').update(JSON.stringify([url.pathname,
  [...url.searchParams].filter(([key]) => key !== 'cursor').sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv))])).digest('hex');
export const encodeCursor = value => Buffer.from(JSON.stringify(value)).toString('base64url');
export function readCursor(url) {
  if (!url.searchParams.has('cursor')) return null;
  try {
    const raw = url.searchParams.get('cursor');
    if (!raw || raw.length > 16_384 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error();
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (value?.v !== 1 || value.scope !== cursorScope(url)) throw new Error();
    return value;
  } catch { throw new ReadCursorError(); }
}
const rowIdentity = row => JSON.stringify([row.store ?? null, row.ledgerId ?? row.project ?? row.db ?? null, row.wf ?? row.workflow ?? null,
  row.id ?? row.unit ?? row.artifactId ?? row.job ?? row.key ?? row.seq ?? row.name ?? createHash('sha256').update(JSON.stringify(row)).digest('hex')]);
/** `rows` paged at the url's `?cursor`/`?limit`; `key` is the collection field ('rows' in most routes, 'data' in work). */
export function page(rows, url, key = 'rows', { identity = rowIdentity } = {}) {
  const cursor = readCursor(url), limit = limitOf(url);
  let offset = 0;
  if (cursor) {
    if (typeof cursor.anchor !== 'string') throw new ReadCursorError();
    const index = rows.findIndex(row => String(identity(row)) === cursor.anchor);
    if (index < 0) throw new ReadCursorError('The page anchor is no longer available. Refresh the first page.');
    offset = index + 1;
  }
  const selected = rows.slice(offset, offset + limit);
  return { [key]: selected, next: offset + limit < rows.length ? encodeCursor({ v: 1, scope: cursorScope(url), anchor: String(identity(selected.at(-1))) }) : null };
}
