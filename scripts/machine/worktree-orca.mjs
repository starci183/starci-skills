// worktree-orca.mjs — the Orca home of the runtime's worktree lifecycle (owner decision WFWT: never write it ourselves when
// Orca has it; deep map WRAP WT1, WT6): an agent's workspace made by Orca and registered, and its one removal. The Kernel's
// workflow worktree (kind workflow) is created by Orca itself - the Kernel's `orchestration worker-start --worktree
// new-child ...` (scripts/kernel/workflow-worktree.mjs), which binds it here - and the draw critic's placement (kind
// critic) and the [Worker] staging checkout (kind supervisor-staging, scripts/supervisor/workers.mjs createStaging) by
// `orca worktree create` (createOrcaWorktree). Orca owns the resource and lists it in its sidebar; the registry keys the
// row by Orca's worktree id (orca_id) and the path Orca reported. reserveOrcaSlot takes the per-repo cap slot BEFORE Orca
// creates anything (a pending row); bindOrcaWorktree turns it into the real row. removeOrcaWorktree removes every link in
// the tree as a link and asserts zero (scripts/api/fs/safe-remove.mjs removeLinksUnder), then `orca worktree rm`
// (scripts/api/orca/worktree-rm.mjs), the main checkout asserted untouched. Never git's worktree removal, never a raw delete.
// The Orca calls are scripts/api/orca/ call files, bundled as orcaWorktreeClient (the `orca` seam a spec fakes:
// tests/helpers/fake-orca-worktrees.mjs); the git ones are scripts/api/git/ call files composed in worktree-git.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { ORCA_KINDS } from '../lib/worktree-kinds.mjs';
import { runtimeStampOf } from '../lib/orca-orphans.mjs';
import { posixPath } from '../lib/path-key.mjs';
import { worktreeSettings, withRegistry, claimWorktree, pendingPathOf, releaseOrcaSlot, sameTree, isGone, markRemoved } from './worktree-registry.mjs';
import { mainRootOf, registeredAt, preserveWork, mainCheckoutGuard, mainCheckoutDamage } from './worktree-git.mjs';
import { worktreeCreate } from '../api/orca/worktree-create.mjs';
import { worktreeRm } from '../api/orca/worktree-rm.mjs';
import { worktreePs } from '../api/orca/worktree-ps.mjs';
import { repoAdd } from '../api/orca/repo-add.mjs';
import { removeLinksUnder } from '../api/fs/safe-remove.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { deleteBranch } from '../api/git/branch-delete.mjs';

/**
 * The Orca worktree calls the runtime makes, as one client object: createOrcaWorktree and removeOrcaWorktree take it as
 * their `orca` seam. ps (worktree-ps.mjs) is the worktree GC's source of truth (worktrees.mjs gcWorktrees).
 */
export const orcaWorktreeClient = Object.freeze({ create: worktreeCreate, remove: worktreeRm, ps: worktreePs, addRepo: repoAdd });

/**
 * Take the per-repo cap slot of an Orca worktree about to be created (a pending row). kind: one of ORCA_KINDS; slotKey:
 * the owner's id (a workflow id, a critic name). cap: default worktrees.capPerRepo for a workflow, none for a critic.
 * {ok, pending, repoRoot} | {ok:false, reason:'worktree-cap'|'worktree-registry-unavailable', live?, cap?, detail}
 */
export function reserveOrcaSlot({ repoRoot, kind, slotKey, owner = {}, cap = undefined, env = process.env, git = null, settings = worktreeSettings() }) {
  if (!ORCA_KINDS.includes(kind)) throw new Error(`reserveOrcaSlot: ${kind} is not an Orca kind (${ORCA_KINDS.join(', ')})`);
  const home = mainRootOf(repoRoot, { git });
  const pending = pendingPathOf(home, kind, slotKey);
  const limit = cap === undefined ? (kind === 'workflow' ? settings.capPerRepo : null) : cap;
  try {
    const r = withRegistry((m) => m.reserveWorktree({ path: pending, kind, repoRoot: home, branch: null, baseSha: null, ledgerId: owner.ledgerId ?? null,
      workflowId: owner.workflowId ?? null, jobId: owner.jobId ?? null, lane: owner.lane ?? null }, { cap: limit }), env);
    if (!r.ok) return { ok: false, reason: r.reason, live: r.live, cap: r.cap, detail: `${home} holds ${r.live} live worktree(s), cap ${r.cap}` };
    return { ok: true, pending, repoRoot: home };
  } catch (error) {
    return { ok: false, reason: 'worktree-registry-unavailable', detail: String(error?.message ?? error).slice(0, 300) };
  }
}

/**
 * Bind a reserved slot to the worktree Orca created: the pending row goes and the row keyed by Orca's id, at the path
 * Orca reported, takes its place with its branch. Without a pending slot (an Orca worktree found again after a crash)
 * the row is registered uncapped. {ok, row} | {ok:false, reason:'worktree-registry-unavailable', detail}
 */
export function bindOrcaWorktree({ pending = null, repoRoot, kind, orcaId, dir, branch = null, baseSha = null, owner = {}, ownerPid = process.pid, env = process.env, git = null }) {
  if (!ORCA_KINDS.includes(kind)) throw new Error(`bindOrcaWorktree: ${kind} is not an Orca kind (${ORCA_KINDS.join(', ')})`);
  const target = path.resolve(dir);
  const home = mainRootOf(repoRoot, { git });
  try {
    const row = withRegistry((m) => m.transaction((db) => {
      const held = pending ? m.worktreeRow(pending) : null;
      if (pending) db.prepare('DELETE FROM worktrees WHERE path=? AND orca_id IS NULL').run(path.resolve(pending));
      db.prepare('UPDATE worktrees SET orca_id=NULL WHERE orca_id=? AND path<>?').run(orcaId, target);
      m.reserveWorktree({ path: target, kind, repoRoot: home, branch, baseSha, ledgerId: owner.ledgerId ?? held?.ledger_id ?? null,
        workflowId: owner.workflowId ?? held?.workflow_id ?? null, jobId: owner.jobId ?? held?.job_id ?? null, lane: owner.lane ?? held?.lane ?? null }, { cap: null });
      db.prepare('UPDATE worktrees SET orca_id=?, created_at=COALESCE(?,created_at) WHERE path=?').run(orcaId, held?.created_at ?? null, target);
      return m.worktreeRow(target);
    }), env);
    claimWorktree({ dir: target, ownerPid, env });
    return { ok: true, row };
  } catch (error) {
    return { ok: false, reason: 'worktree-registry-unavailable', detail: String(error?.message ?? error).slice(0, 300) };
  }
}

/**
 * Create an Orca worktree (a Kernel workflow's, scripts/kernel/workflow-worktree.mjs; the draw critic's placement; a [Worker] staging checkout): the
 * slot reserved, `orca worktree create --repo path:<repo> --name <name> --base-branch <base> --setup <setup> --no-parent`,
 * the row bound to what Orca returned (its id, path and branch).
 * {ok, id, path, branch, head} | {ok:false, reason:'worktree-cap'|'worktree-registry-unavailable'|'orca-worktree-create-failed', detail}
 */
export function createOrcaWorktree({ repoRoot, kind, name, base, setup = 'skip', owner = {}, ownerPid = process.pid, cap = undefined, env = process.env, git = null,
  orca = orcaWorktreeClient, settings = worktreeSettings() }) {
  const slot = reserveOrcaSlot({ repoRoot, kind, slotKey: name, owner, cap, env, git, settings });
  if (!slot.ok) return slot;
  // The runtime's ownership stamp, always, in the creating call itself: a tree whose bind never happens is still
  // recognisably the runtime's (scripts/lib/orca-orphans.mjs; the GC's orphan pass).
  const comment = runtimeStampOf({ kind, slot: name, owner: { ...owner, supJobId: owner.lane ?? null } });
  const ask = () => orca.create({ repo: `path:${posixPath(slot.repoRoot)}`, name, baseBranch: base, setup, comment });
  let made = ask();
  // A repository Orca does not know yet is registered once (idempotent), then the creation is asked again.
  if (!made?.ok && made?.errorCode === 'repo_not_found' && orca.addRepo && orca.addRepo({ path: posixPath(slot.repoRoot) })?.ok) made = ask();
  if (!made?.ok || !made.worktree?.id || !made.worktree?.path) {
    releaseOrcaSlot(slot.pending, { env });
    return { ok: false, reason: 'orca-worktree-create-failed', detail: String(made?.error ?? made?.errorCode ?? 'no worktree in the receipt').slice(0, 400) };
  }
  const w = made.worktree;
  const bound = bindOrcaWorktree({ pending: slot.pending, repoRoot: slot.repoRoot, kind, orcaId: w.id, dir: w.path, branch: w.branch ?? null, baseSha: w.head ?? null, owner, ownerPid, env, git });
  if (!bound.ok) {
    // An unregistered Orca tree is a leak no GC pass sees: it goes straight back.
    removeOrcaWorktree({ repoRoot: slot.repoRoot, orcaId: w.id, dir: w.path, env, git, orca });
    return { ok: false, reason: bound.reason, detail: bound.detail };
  }
  return { ok: true, id: w.id, path: path.resolve(w.path), branch: w.branch ?? null, head: w.head ?? null };
}

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
  const before = fs.existsSync(home) ? mainCheckoutGuard(home, { git }) : null;
  const unlinked = removeLinksUnder(target);
  out.links = unlinked.links;
  if (!unlinked.ok) {
    markRemoved(target, { error: `link-stuck: ${unlinked.errors[0]?.path ?? ''}`.slice(0, 300), env });
    return { ...out, reason: 'link-stuck', errors: unlinked.errors.slice(0, 5) };
  }
  const rm = fs.existsSync(target) || (fs.existsSync(home) && registeredAt(home, target, { git })) ? orca.remove({ worktree: `id:${orcaId}`, force: true }) : { ok: true, removed: true };
  if (before) {
    const damage = mainCheckoutDamage(before, mainCheckoutGuard(home, { git }));
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
