// ref-value.mjs — the one accessor of a column that holds content or a reference to it (the storage convention, modules/schemas/storage-convention.yaml: content is a file in
// the blob store under the runtime state dir, a row holds the reference).
//
// A column of class migrate holds either the content inline (the legacy shape, every row written before the convention) or a REFERENCE: a JSON string literal that names the blob,
// "\u0001ref:<sha256>:<bytes>" (the quotes and the backslash escape are part of the text, so it also passes a column's json_valid check). Every handle either store opens installs
// the resolver below, so a reader that selects such a column gets the content whichever shape the row has; a writer stores content with `putContent`, which keeps a short value
// inline and puts a long one in the blob store. A value is resolved byte for byte: the blob holds exactly the text the writer was given.
import { getBlob, putBlob } from './blob.mjs';

const MARK = String.raw`"\u0001ref:`;
const REF = new RegExp(`^${MARK.replaceAll('\\', '\\\\')}([0-9a-f]{64}):(\\d+)"$`);

/** Whether a stored value is a reference. */
export const isRef = (value) => typeof value === 'string' && value.charCodeAt(0) === 34 && REF.test(value);

/** The reference string of a blob. */
export const refOf = (sha, bytes) => `${MARK}${sha}:${bytes}"`;

/** The {sha, bytes} a reference names, or null. */
export function parseRef(value) {
  const match = typeof value === 'string' && value.charCodeAt(0) === 34 ? REF.exec(value) : null;
  return match ? { sha: match[1], bytes: Number(match[2]) } : null;
}

/** The content behind a stored value: a reference is read from the blob store (utf8), anything else is the content itself. */
export function resolveValue(value) {
  const ref = parseRef(value);
  if (!ref) return value;
  return getBlob(ref.sha).toString('utf8');
}

/**
 * What to store for `text` in a column bounded to `bound` bytes: the text itself when it fits, else a reference to a blob that holds it whole. `put` is the blob writer (the
 * default is the runtime blob store); a null or non-string value is stored as it is.
 */
export function putContent(text, { bound, put = (bytes) => putBlob(bytes, { mediaType: 'text/plain' }) } = {}) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') <= bound) return text;
  const bytes = Buffer.from(text, 'utf8');
  return refOf(put(bytes).sha, bytes.length);
}

const resolveRow = (row) => {
  if (row === null || row === undefined || typeof row !== 'object') return row;
  for (const key of Object.keys(row)) if (isRef(row[key])) row[key] = resolveValue(row[key]);
  return row;
};

/**
 * Makes every row a statement of `db` returns resolve its reference values: get, all and iterate. The handle is changed in place and returned; a handle that was already
 * installed is left alone. Other statement methods (run, columns, ...) are the statement's own.
 */
export function installRefResolver(db) {
  if (db.__refResolver) return db;
  // The prototype's prepare is looked up at each call, so a later change of the driver's own method (a spec's mock, a corruption injection) still applies.
  const prototype = Object.getPrototypeOf(db);
  db.prepare = (sql, ...rest) => {
    const statement = prototype.prepare.call(db, sql, ...rest);
    return new Proxy(statement, {
      get(target, name) {
        const member = target[name];
        if (typeof member !== 'function') return member;
        if (name === 'get') return (...args) => resolveRow(member.apply(target, args));
        if (name === 'all') return (...args) => member.apply(target, args).map(resolveRow);
        if (name === 'iterate') return (...args) => (function* resolved(iterator) { for (const row of iterator) yield resolveRow(row); })(member.apply(target, args));
        return member.bind(target);
      },
    });
  };
  Object.defineProperty(db, '__refResolver', { value: true });
  return db;
}
