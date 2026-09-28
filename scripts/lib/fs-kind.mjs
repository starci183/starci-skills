// fs-kind.mjs — the forgiving fs.statSync probes a dozen scripts re-declared by hand.
// A missing or unreadable path is false/null, never a throw; the stat syscall decides kind.
import fs from 'node:fs';

/** `p` names a file; false on any stat error (missing path, dangling link, EPERM). */
export const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
/** `p` names a directory; false on any stat error. */
export const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
/** `p`'s canonical spelling via the filesystem (links resolved), or null when it cannot be read. */
export const realpathOr = (p) => { try { return fs.realpathSync.native(p); } catch { return null; } };
