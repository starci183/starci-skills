// inside-path.mjs - path containment the way this host's filesystem spells paths. scripts/lib/path-key.mjs re-exports these.
import path from 'node:path';

const WIN = process.platform === 'win32';

/** `p` case-folded where the filesystem ignores case (Windows). */
export const foldCase = (p) => (WIN ? p.toLowerCase() : p);
/** `p` resolved and case-folded where the filesystem ignores case — the Map key of an absolute path. */
export const resolvedKey = (p) => foldCase(path.resolve(p));
/**
 * Whether `file` sits under `root`; `includeSelf` also admits the root itself. `key` normalizes
 * both sides first (e.g. the registry's realpath-folded treeKey) when their spellings need it.
 */
export const insidePath = (root, file, { key = (p) => p, includeSelf = false } = {}) => {
  const rel = path.relative(key(root), key(file));
  return (includeSelf || Boolean(rel)) && !rel.startsWith('..') && !path.isAbsolute(rel);
};
