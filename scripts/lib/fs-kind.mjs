// fs-kind.mjs — the forgiving fs.statSync probes a dozen scripts re-declared by hand.
// A missing or unreadable path is false/null, never a throw; the stat syscall decides kind.
import fs from 'node:fs';

/** `p` names a file within `maxBytes`; false on any stat error. `followLinks: false` probes the entry itself. */
export const isFile = (p, { followLinks = true, maxBytes = Infinity } = {}) => {
  try {
    const stat = followLinks ? fs.statSync(p) : fs.lstatSync(p);
    return stat.isFile() && (followLinks || !stat.isSymbolicLink()) && stat.size <= maxBytes;
  } catch { return false; }
};
/** `p` names a directory; false on any stat error. `followLinks: false` refuses linked entries. */
export const isDir = (p, { followLinks = true } = {}) => {
  try {
    const stat = followLinks ? fs.statSync(p) : fs.lstatSync(p);
    return stat.isDirectory() && (followLinks || !stat.isSymbolicLink());
  } catch { return false; }
};
/** `p`'s canonical spelling via the filesystem (links resolved), or null when it cannot be read. */
export const realpathOr = (p) => { try { return fs.realpathSync.native(p); } catch { return null; } };
