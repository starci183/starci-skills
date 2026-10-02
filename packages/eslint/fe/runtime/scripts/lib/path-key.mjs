// path-key.mjs — spelling and comparing paths the way this host's filesystem does.
import fs from 'node:fs';
import path from 'node:path';

const WIN = process.platform === 'win32';

/** `p` with every backslash turned into a forward slash; null and undefined read as ''. */
export const slash = (p) => String(p ?? '').replaceAll('\\', '/');
/** A relative path in git's spelling: forward slashes, no leading './'. */
export const posixPath = (p) => slash(p).replace(/^\.\//, '');
/** Whether posix `file` is `prefix` itself or under it (`file === prefix || file` starts with `prefix/`). */
export const sameOrUnder = (file, prefix) => file === prefix || file.startsWith(`${prefix}/`);
/** `p` case-folded where the filesystem ignores case (Windows). */
export const foldCase = (p) => (WIN ? p.toLowerCase() : p);
/** Whether two spellings name the same path on this host's filesystem. */
export const samePath = (a, b) => foldCase(a) === foldCase(b);
/**
 * A path's comparable identity: absolute, forward slashes, no trailing slash, case-folded on Windows.
 * `fold: true` folds case on every platform (a comparison against a lowercase-stored root needs it).
 */
export const pathKey = (p, { fold = WIN } = {}) => {
  const key = slash(path.resolve(p)).replace(/\/+$/, '');
  return fold ? key.toLowerCase() : key;
};
/** `a` is `b` or under it, or the reverse: two path spellings whose trees touch. */
export const pathsOverlap = (a, b) => sameOrUnder(a, b) || sameOrUnder(b, a);
/**
 * A path-ish string in compare form, options in spelling order:
 * `trim` blanks at the ends, `collapse` folds '//' runs to '/', `dot` drops a leading './',
 * `glob` strips a trailing glob ('star': '*'/'**' with their slash, 'double': a '/**' only),
 * `fold` lowercases. A trailing '/' always goes. Null reads as ''.
 */
export const normPath = (p, { trim = false, collapse = false, dot = false, glob = null, fold = false } = {}) => {
  let s = String(p ?? '');
  if (trim) s = s.trim();
  s = slash(s);
  if (collapse) s = s.replace(/\/{2,}/g, '/');
  if (dot) s = s.replace(/^\.\//, '');
  if (glob === 'star') s = s.replace(/\/?\*+$/, '');
  else if (glob === 'double') s = s.replace(/\/\*\*$/, '');
  s = s.replace(/\/+$/, '');
  return fold ? s.toLowerCase() : s;
};
/** A work-relative path in one spelling: forward slashes, no leading ./, no trailing slash. */
export const normWork = (p) => String(p ?? '').trim().replaceAll('\\', '/').replace(/^\.\/+/, '').replace(/\/+$/, '');

/** `p` resolved and dereferenced (realpath where the path exists) — the canonical spelling of a checkout dir. */
export const realPath = (p) => {
  const resolved = path.resolve(p);
  try { return fs.realpathSync.native(resolved); } catch { return resolved; }
};
/** `p` resolved and case-folded where the filesystem ignores case — the Map key of an absolute path. */
export const resolvedKey = (p) => foldCase(path.resolve(p));
/** Whether `a` and `b` resolve to the same path (always case-folded, so differently-cased spellings count). */
export const sameResolvedPath = (a, b) => pathKey(a, { fold: true }) === pathKey(b, { fold: true });
/**
 * Whether `file` sits strictly under `root`. `key` normalizes both sides first (e.g. the registry's
 * realpath-folded treeKey) when the callers' spellings need it.
 */
export const insidePath = (root, file, { key = (p) => p } = {}) => {
  const rel = path.relative(key(root), key(file));
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
};
/**
 * A path-ish value (a string or a {path} entry) in relative compare form: trimmed, forward slashes,
 * no trailing '/**' glob or slashes, no leading './'; `fold` lowercases for a case-insensitive key.
 */
export const normRel = (p, { fold = false } = {}) => {
  const s = String(typeof p === 'string' ? p : p?.path ?? '').trim().replace(/\\/g, '/').replace(/\/\*\*$/, '').replace(/\/+$/, '').replace(/^\.\//, '');
  return fold ? s.toLowerCase() : s;
};
/** Whether `file` equals or sits under one of `prefixes` (posix spellings; `dot` counts a '.' prefix as covering all). */
export const underAny = (file, prefixes, { dot = false } = {}) =>
  (prefixes ?? []).some((p) => (dot && p === '.') || sameOrUnder(file, p));
