// remove-links-under.mjs — the link step of every worktree removal (scripts/machine/worktree-git.mjs safeRemoveWorktree,
// scripts/machine/worktree-orca.mjs removeOrcaWorktree): every link under a tree removed as a link, never its target.
import fs from 'node:fs';
import { linksUnder } from './links-under.mjs';
import { unlinkOnly } from './lib.mjs';

/**
 * Every link under `target` found WITHOUT following one (linksUnder), each unlinked and verified gone (unlinkOnly),
 * outermost first, then a re-scan that must find ZERO. {ok, links, errors: [{path, code, message}]};
 * ok false keeps the caller from removing the tree; some links may already have been removed.
 */
export function removeLinksUnder(target) {
  const out = { ok: false, links: 0, errors: [] };
  if (!fs.existsSync(target)) { out.ok = true; return out; }
  for (const link of linksUnder(target)) { if (unlinkOnly(link)) out.links += 1; else out.errors.push({ path: link, code: 'LINK_STUCK', message: 'a link could not be removed' }); }
  for (const l of linksUnder(target)) if (!out.errors.some((e) => e.path === l)) out.errors.push({ path: l, code: 'LINK_STUCK', message: 'a link is still there after removal' });
  out.ok = out.errors.length === 0;
  return out;
}
