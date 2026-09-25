// path-key.mjs — spelling and comparing paths the way this host's filesystem does.
import path from 'node:path';

const WIN = process.platform === 'win32';

/** `p` with every backslash turned into a forward slash; null and undefined read as ''. */
export const slash = (p) => String(p ?? '').replaceAll('\\', '/');
/** A relative path in git's spelling: forward slashes, no leading './'. */
export const posixPath = (p) => slash(p).replace(/^\.\//, '');
/** `p` case-folded where the filesystem ignores case (Windows). */
export const foldCase = (p) => (WIN ? p.toLowerCase() : p);
/** Whether two spellings name the same path on this host's filesystem. */
export const samePath = (a, b) => foldCase(a) === foldCase(b);
/** A path's comparable identity: absolute, forward slashes, no trailing slash, case-folded on Windows. */
export const pathKey = (p) => foldCase(slash(path.resolve(p)).replace(/\/+$/, ''));
