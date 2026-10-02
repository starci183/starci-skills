// query.mjs — the read prelude the api routes share (routes/*.mjs): `source` tuples for the envelope's sources
// list, the `many`/`one` sql readers, a forgiving `parse` of a json column, the store's `stale` list, and the
// `?limit`/`?cursor` paging (a cursor is a base64url {offset}; `limit` is capped at 200, default 50).
export const source = (db, ...rels) => rels.map(rel => ({ db, rel }));
export const many = (db, sql, ...args) => db.prepare(sql).all(...args);
export const one = (db, sql, ...args) => db.prepare(sql).get(...args) ?? null;
export const parse = (value, fallback = null) => { try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; } };
export const staleOf = store => [...store.stale];
export const limitOf = url => Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));
export const cursorOf = url => { try { return Math.max(0, Number(JSON.parse(Buffer.from(url.searchParams.get('cursor') ?? '', 'base64url').toString()).offset) || 0); } catch { return 0; } };
export const nextOf = offset => Buffer.from(JSON.stringify({ offset })).toString('base64url');
/** `rows` paged at the url's `?cursor`/`?limit`; `key` is the collection field ('rows' in most routes, 'data' in work). */
export const page = (rows, url, key = 'rows') => { const offset = cursorOf(url), limit = limitOf(url); return { [key]: rows.slice(offset, offset + limit), next: offset + limit < rows.length ? nextOf(offset + limit) : null }; };
