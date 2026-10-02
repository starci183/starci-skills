// is-link-like.mjs — whether a path is a link of any kind (a symlink, a junction, or another reparse point that
// redirects it), read with lstat, readlink and real paths. Every tree walk of the runtime asks it before it enters a
// directory (safe-remove.mjs, links-under.mjs, the housekeeping collectors), so no walk ever follows a link
// (nivo-fe inc-c8fbf76aa499).
import fs from 'node:fs';
import path from 'node:path';
import { samePath } from '../../lib/path-key.mjs';
import { realpathOr } from '../../lib/fs-kind.mjs';

/**
 * True when `p` is a link of any kind: a symlink, a junction, or another reparse point that redirects it.
 * `parentReal` (the real path of p's parent, when the caller walked to it through real directories) lets the
 * real-path test catch a reparse point lstat and readlink do not report. A missing path is not a link.
 */
export function isLinkLike(p, { parentReal = null, stat = null } = {}) {
  let st = stat;
  if (!st) { try { st = fs.lstatSync(p); } catch { return false; } }
  if (st.isSymbolicLink()) return true;
  if (!st.isDirectory()) return false;
  try { fs.readlinkSync(p); return true; } catch { /* not a link readlink can read */ }
  const parent = parentReal ?? realpathOr(path.dirname(p));
  const real = realpathOr(p);
  if (!parent || !real) return true; // cannot prove it is a plain directory: treat it as a link
  return !samePath(real, path.join(parent, path.basename(p)));
}
