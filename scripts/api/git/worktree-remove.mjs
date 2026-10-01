// worktree-remove.mjs — remove a scratch worktree the runtime made with git (worktree-add.mjs): links first, then
// `git worktree remove --force` and prune (scripts/api/fs/safe-remove.mjs safeRemoveWorktree), verified, the row closed.
import fs from 'node:fs';
import path from 'node:path';
import { gitRunner } from './lib.mjs';
import { registeredAt } from './worktree-list.mjs';
import { revParse } from './rev-parse.mjs';
import { deleteBranch } from './branch-delete.mjs';
import { preserveWork } from './preserve-work.mjs';
import { safeRemoveWorktree } from '../fs/safe-remove.mjs';
import { markRemoved } from '../../machine/worktree-registry.mjs';

/**
 * Remove a scratch worktree the runtime made with git. preserve: {name} -> preserveWork first (a failure keeps the
 * tree). Then safe-remove.mjs safeRemoveWorktree: every link removed as a link (found without following one), zero links
 * asserted, `git worktree remove --force`, prune, and the main checkout asserted untouched (a violation is fatal:
 * {fatal:true, reason:'main-checkout-damaged'} and the GC stops). The removal is verified, and the branch is deleted:
 * 'merged' -> `git branch -d` (git refuses an unmerged one), 'force' -> `git branch -D` (only after a preserve).
 * {ok, path, verified: {dirGone, pruned}, links, preserved, branch} | {ok:false, reason, fatal?, ...}
 */
export function removeScratchWorktree({ repoRoot, dir, branch = null, deleteBranch: mode = null, preserve = null, main = 'main', env = process.env, git = null }) {
  const run = gitRunner(git);
  const target = path.resolve(dir);
  const out = { ok: false, path: target, verified: { dirGone: false, pruned: false }, links: 0, preserved: null, branch: branch ? { name: branch, deleted: false } : null };
  if (preserve && fs.existsSync(target)) {
    const p = preserveWork({ repoRoot, dir: target, name: preserve.name, main });
    if (!p.ok) { markRemoved(target, { error: `preserve: ${p.step ?? p.reason}`, env }); return { ...out, reason: 'preserve-failed', detail: p }; }
    out.preserved = p.ref ? { ref: p.ref, sha: p.sha, dirty: p.dirty } : null;
  }
  const rm = safeRemoveWorktree(target, { repo: repoRoot, git: run });
  out.links = rm.links ?? 0;
  if (rm.fatal) { markRemoved(target, { error: `main checkout damaged: ${(rm.damage ?? []).join('; ').slice(0, 200)}`, env }); return { ...out, reason: 'main-checkout-damaged', fatal: true, damage: rm.damage }; }
  if (!rm.ok) {
    markRemoved(target, { error: `${rm.reason ?? 'remove-failed'}: ${rm.errors[0]?.path ?? ''}`.slice(0, 300), env });
    if (rm.reason === 'link-stuck') return { ...out, reason: 'link-stuck', errors: rm.errors.slice(0, 5) };
    return { ...out, reason: 'remove-failed', errors: rm.errors.slice(0, 5) };
  }
  out.verified.dirGone = !fs.existsSync(target);
  out.verified.pruned = !registeredAt(repoRoot, target, { git });
  if (!out.verified.dirGone || !out.verified.pruned) {
    const reason = out.verified.dirGone ? 'prune-unverified' : 'dir-remains';
    markRemoved(target, { error: reason, env });
    return { ...out, reason };
  }
  if (branch && mode && revParse(repoRoot, `refs/heads/${branch}`)) {
    const deleted = deleteBranch({ repoRoot, branch, mode, main, git });
    out.branch.deleted = deleted.ok;
    if (!deleted.ok) { markRemoved(target, { preservedRef: out.preserved?.ref ?? null, env }); return { ...out, ok: false, reason: 'branch-delete-failed', detail: deleted.detail }; }
  } else if (out.branch) out.branch.deleted = !revParse(repoRoot, `refs/heads/${branch}`);
  markRemoved(target, { preservedRef: out.preserved?.ref ?? null, env });
  out.ok = true;
  return out;
}
