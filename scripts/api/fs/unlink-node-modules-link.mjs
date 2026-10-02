// unlink-node-modules-link.mjs — unlink `<dir>/node_modules` when it is a link (one an older runtime made; no runtime
// code makes one, RT_NODE_MODULES_LINK). The link only, never what it points at (scripts/supervisor/land.mjs).
import fs from 'node:fs';
import path from 'node:path';

/** true when no link is left at `<dir>/node_modules`; a real directory is left alone (true: it is the checkout's own). */
export function unlinkNodeModulesLink(dir) {
  const nm = path.join(dir, 'node_modules');
  let st;
  try { st = fs.lstatSync(nm); } catch { return true; }
  if (!st.isSymbolicLink()) return true;
  try { fs.unlinkSync(nm); } catch { try { fs.rmdirSync(nm); } catch { /* checked below */ } }
  try { fs.lstatSync(nm); return false; } catch { return true; }
}
