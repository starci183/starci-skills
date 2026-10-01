// worktree-provision.mjs — an agent's workspace made by Orca and registered (owner decision WFWT: never write it
// ourselves when Orca has it). The Kernel's workflow worktree (kind workflow) is created by Orca itself - the Kernel's
// `orchestration worker-start --worktree new-child ...` (scripts/kernel/workflow-worktree.mjs), which binds it here - and
// the draw critic's placement (kind critic) and the [Worker] staging checkout (kind supervisor-staging,
// scripts/supervisor/workers.mjs createStaging) by `orca worktree create` (createOrcaWorktree). Orca owns the resource and
// lists it in its sidebar; the registry keys the row by Orca's worktree id (orca_id) and the path Orca reported.
// reserveOrcaSlot takes the per-repo cap slot BEFORE Orca creates anything (a pending row); bindOrcaWorktree turns it
// into the real row. Its removal is worktree-remove.mjs.
import path from 'node:path';
import { orcaWorktreeClient } from './worktree-client.mjs';
import { removeOrcaWorktree } from './worktree-remove.mjs';
import { mainRootOf } from '../git/worktree-list.mjs';
import { ORCA_KINDS, worktreeSettings, withRegistry, claimWorktree, pendingPathOf, releaseOrcaSlot } from '../../lib/worktree-registry.mjs';

const posixPath = (p) => String(p).replace(/\\/g, '/');

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
export function createOrcaWorktree({ repoRoot, kind, name, base, setup = 'skip', owner = {}, ownerPid = process.pid, cap = undefined, comment = null, env = process.env, git = null,
  orca = orcaWorktreeClient, settings = worktreeSettings() }) {
  const slot = reserveOrcaSlot({ repoRoot, kind, slotKey: name, owner, cap, env, git, settings });
  if (!slot.ok) return slot;
  const ask = () => orca.create({ repo: `path:${posixPath(slot.repoRoot)}`, name, baseBranch: base, setup, ...(comment ? { comment } : {}) });
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
