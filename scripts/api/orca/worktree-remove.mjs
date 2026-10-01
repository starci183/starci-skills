// worktree-remove.mjs — the one removal of a worktree Orca made (worktree-provision.mjs): every link in the tree removed
// as a link and zero asserted (scripts/lib/safe-remove.mjs removeLinksUnder), then `orca worktree rm` (worktree-rm.mjs),
// the main checkout asserted untouched. Never git's worktree removal, never a raw delete.
import fs from 'node:fs';
import path from 'node:path';
import { orcaWorktreeClient } from './worktree-client.mjs';
import { gitRunner } from '../git/lib.mjs';
import { mainRootOf, registeredAt } from '../git/worktree-list.mjs';
import { revParse } from '../git/rev-parse.mjs';
import { deleteBranch } from '../git/branch-delete.mjs';
import { preserveWork } from '../git/preserve-work.mjs';
import { removeLinksUnder, mainCheckoutGuard, mainCheckoutDamage } from '../../lib/safe-remove.mjs';
import { sameTree, isGone, markRemoved } from '../../lib/worktree-registry.mjs';

/**
 * Remove a worktree Orca made (scripts/kernel/workflow-worktree.mjs releaseWorkflowWorktree, the critic, the GC).
 * preserve: {name} -> preserveWork first (a failure keeps the tree). Then every link in the tree removed as a link and
 * ZERO asserted (a stuck link keeps the tree: link-stuck), `orca worktree rm --worktree id:<orcaId> --force`, the main
 * checkout asserted untouched (a violation is fatal: main-checkout-damaged, and the GC stops), the directory and its git
 * registration verified gone, the row marked removed. Orca deletes the branch itself when it can prove it merged;
 * `deleteBranch` 'merged' (`git branch -d`) or 'force' (`-D`, only after a preserve) handles a branch it kept.
 * {ok, path, links, preserved, branch} | {ok:false, reason, fatal?, ...}
 */
export function removeOrcaWorktree({ repoRoot, orcaId, dir, branch = null, deleteBranch: mode = null, preserve = null, main = 'main', env = process.env, git = null, orca = orcaWorktreeClient }) {
  const target = path.resolve(dir);
  const out = { ok: false, path: target, orcaId, links: 0, preserved: null, branch: branch ? { name: branch, deleted: false } : null };
  const home = fs.existsSync(repoRoot) ? mainRootOf(repoRoot, { git }) : path.resolve(repoRoot);
  if (sameTree(home, target)) return { ...out, reason: 'remove-failed', errors: [{ path: target, code: 'REFUSED', message: 'refusing to remove the main checkout' }] };
  if (preserve && fs.existsSync(target)) {
    const p = preserveWork({ repoRoot: home, dir: target, name: preserve.name, main });
    if (!p.ok) { markRemoved(target, { error: `preserve: ${p.step ?? p.reason}`, env }); return { ...out, reason: 'preserve-failed', detail: p }; }
    out.preserved = p.ref ? { ref: p.ref, sha: p.sha, dirty: p.dirty } : null;
  }
  const before = fs.existsSync(home) ? mainCheckoutGuard(home, { git: gitRunner(git) }) : null;
  const unlinked = removeLinksUnder(target);
  out.links = unlinked.links;
  if (!unlinked.ok) {
    markRemoved(target, { error: `link-stuck: ${unlinked.errors[0]?.path ?? ''}`.slice(0, 300), env });
    return { ...out, reason: 'link-stuck', errors: unlinked.errors.slice(0, 5) };
  }
  const rm = fs.existsSync(target) || (fs.existsSync(home) && registeredAt(home, target, { git })) ? orca.remove({ worktree: `id:${orcaId}`, force: true }) : { ok: true, removed: true };
  if (before) {
    const damage = mainCheckoutDamage(before, mainCheckoutGuard(home, { git: gitRunner(git) }));
    if (damage.length) {
      markRemoved(target, { error: `main checkout damaged: ${damage.join('; ').slice(0, 200)}`, env });
      return { ...out, reason: 'main-checkout-damaged', fatal: true, damage };
    }
  }
  if (!rm?.ok) {
    markRemoved(target, { error: `orca worktree rm: ${String(rm?.error ?? rm?.errorCode ?? 'refused').slice(0, 200)}`, env });
    return { ...out, reason: 'orca-worktree-rm-failed', detail: String(rm?.error ?? rm?.errorCode ?? '').slice(0, 300), hostUnavailable: rm?.hostUnavailable === true };
  }
  const dirGone = isGone(target);
  const pruned = !(fs.existsSync(home) && registeredAt(home, target, { git }));
  if (!dirGone || !pruned) {
    const reason = dirGone ? 'prune-unverified' : 'dir-remains';
    markRemoved(target, { error: reason, env });
    return { ...out, reason };
  }
  if (branch && mode && revParse(home, `refs/heads/${branch}`)) {
    const deleted = deleteBranch({ repoRoot: home, branch, mode, main, git });
    out.branch.deleted = deleted.ok;
    if (!deleted.ok) { markRemoved(target, { preservedRef: out.preserved?.ref ?? null, env }); return { ...out, reason: 'branch-delete-failed', detail: deleted.detail }; }
  } else if (out.branch) out.branch.deleted = !revParse(home, `refs/heads/${branch}`);
  markRemoved(target, { preservedRef: out.preserved?.ref ?? null, env });
  out.ok = true;
  return out;
}
