// remove-links-under.mjs — the link step of every worktree removal (scripts/machine/worktree-git.mjs safeRemoveWorktree,
// scripts/machine/worktree-orca.mjs removeOrcaWorktree): every link under a tree removed as a link, never its target.
import fs from 'node:fs';
import { linksUnder } from './links-under.mjs';
import { rmdirLink } from './rmdir-link.mjs';
import { unlinkOnly } from './lib.mjs';

const WIN = process.platform === 'win32';

/** Remove one link as a link, never its target: `cmd /c rmdir <link>` on Windows (no /s), then unlinkOnly. */
function removeLink(p) {
  if (WIN) {
    let st = null;
    try { st = fs.lstatSync(p); } catch { return true; }
    if (st.isDirectory() || st.isSymbolicLink()) rmdirLink(p);
  }
  return unlinkOnly(p);
}

/**
 * Every link under `target` found WITHOUT following one (linksUnder), each removed as a link (removeLink: `cmd /c rmdir
 * <link>`, never /s), outermost first, then a re-scan that must find ZERO. {ok, links, errors: [{path, code, message}]};
 * ok false: a link is stuck and the caller removes nothing.
 */
export function removeLinksUnder(target) {
  const out = { ok: false, links: 0, errors: [] };
  if (!fs.existsSync(target)) { out.ok = true; return out; }
  for (const link of linksUnder(target)) { if (removeLink(link)) out.links += 1; else out.errors.push({ path: link, code: 'LINK_STUCK', message: 'a link could not be removed' }); }
  for (const l of linksUnder(target)) if (!out.errors.some((e) => e.path === l)) out.errors.push({ path: l, code: 'LINK_STUCK', message: 'a link is still there after removal' });
  out.ok = out.errors.length === 0;
  return out;
}
