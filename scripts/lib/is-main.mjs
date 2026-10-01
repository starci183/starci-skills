// is-main.mjs - split from scripts/lib/walk.mjs (realPathOf, isMain).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** True when this module is the process entry point (`node file.mjs`, not an import). */
/** The real path of a file, or its resolved path when it cannot be read (a missing file is never the entry module). */
const realPathOf = (file) => { try { return fs.realpathSync.native(path.resolve(file)); } catch { return path.resolve(file); } };
/**
 * True when the module at `metaUrl` is the process entry point. Both sides are compared as REAL paths: Node gives a module
 * its symlink-resolved URL, while argv[1] keeps the path it was started with, so an entry reached through a node_modules
 * junction or symlink (a lane worktree, an npx shim) would otherwise look like an import and silently do nothing.
 */
export const isMain = (metaUrl, argv = process.argv) => Boolean(argv[1]) && realPathOf(argv[1]) === realPathOf(fileURLToPath(metaUrl));
