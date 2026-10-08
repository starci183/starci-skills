// workflow-custody.mjs - a workflow keeps its branch: the commits of its checkpoints and the work a collector preserved
// are re-attached to whatever tree the workflow gets next, never replaced by a tree cut from main.
//
// What a workflow owns in its app repository: every local branch Orca named after it (wf-<id>, then wf-<id>-2, ... when the
// name was taken) and the ref a collector preserved for it (refs/heads/preserved/<id>/gc: the uncommitted work of the tree
// at collection, one commit above the branch). Those refs must form ONE chain, each an ancestor of the next; the top of the
// chain is where the workflow continues:
//   branchTip   the highest branch: the last checkpoint (no branch left: the last registered checkpoint on the chain). A tree is
//               correct when its HEAD contains it.
//   restore     the preserved commit above branchTip, when there is one: its change is put back in the tree as uncommitted
//               work (fast-forward to it, then a mixed reset to branchTip), exactly the state the collector found; the ref is
//               then kept under preserved/<id>/restored-<sha>, so a restore happens once.
// A new tree is cut at branchTip; a registered tree that is behind it (created from main after the original was lost) is
// fast-forwarded in place, its own uncommitted work preserved first as preserved/<id>/wrong-tree. Refs that do not form a
// chain, or a tree holding commits of its own off the chain, are never merged or dropped: they answer a typed refusal and the
// workflow waits for its owner. Only a workflow with no ref at all starts from the base.
import { branchList } from '../api/git/branch-list.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { isAncestor } from '../api/git/is-ancestor.mjs';
import { merge } from '../api/git/merge.mjs';
import { reset } from '../api/git/reset.mjs';
import { updateRef } from '../api/git/update-ref.mjs';
import { branchDelete } from '../api/git/branch-delete.mjs';
import { withMachine } from '../../engine/db/machine.mjs';
import { PRESERVED_PREFIX } from '../machine/worktree-registry.mjs';
import { preserveWork } from '../machine/worktree-git.mjs';

const escapeRegExp = (text) => String(text).replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
const refOf = (name) => `refs/heads/${name}`;

// The registry rows the workflow ever had (live and closed), oldest first: their branches and checkpoints.
function rowsOf(workflowId, env) {
  return withMachine((m) => m.db.prepare("SELECT branch, checkpoint_sha, created_at FROM worktrees WHERE kind='workflow' AND workflow_id=? ORDER BY created_at").all(workflowId), { env });
}

// Every local branch Orca named after the workflow, plus the branches its registry rows recorded.
function branchNames(appRepo, workflowId, rows) {
  const listed = branchList(['--format=%(refname:short)', `*wf-${workflowId}*`], { cwd: appRepo });
  const own = new RegExp(String.raw`^(?:.+/)?wf-${escapeRegExp(workflowId)}(?:-\d+)?$`);
  const names = String(listed.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).filter((line) => own.test(line));
  return [...new Set([...names, ...rows.map((r) => r.branch).filter(Boolean)])];
}

const resolved = (appRepo, names, kind) => names.map((name) => ({ name, kind, sha: revParse(appRepo, refOf(name)) })).filter((c) => c.sha);

// The candidate every other one is an ancestor of; among equals the latest registered branch, a branch before a preserved ref.
function chainTop(appRepo, candidates, rows) {
  const recency = (c) => rows.findLastIndex((r) => r.branch === c.name);
  const tops = candidates.filter((c) => candidates.every((o) => isAncestor(appRepo, o.sha, c.sha)));
  const rank = (c) => (c.kind === 'branch' ? 1_000_000 : 0) + recency(c);
  return tops.toSorted((a, b) => rank(b) - rank(a))[0] ?? null;
}

// With no branch left (a collector removed it after preserving), the last checkpoint the registry recorded that the chain holds; else the tip itself.
function lastCheckpoint(appRepo, rows, tip) {
  const held = rows.map((r) => r.checkpoint_sha).filter((sha) => sha && isAncestor(appRepo, sha, tip.sha));
  return held.at(-1) ?? tip.sha;
}

/**
 * What the workflow owns in `appRepo`: {none:true} when it has no ref yet; {fault:{code, detail}} when its refs do not form
 * one chain; else {branchTip:{name|null, sha}, tip:{name, sha}, restore: sha|null, preservedRef: name|null}.
 */
export function workflowCustody({ appRepo, workflowId, env = process.env }) {
  const rows = rowsOf(workflowId, env);
  const branches = resolved(appRepo, branchNames(appRepo, workflowId, rows), 'branch');
  const preserved = resolved(appRepo, [`${PRESERVED_PREFIX}/${workflowId}/gc`], 'preserved');
  const all = [...branches, ...preserved];
  if (!all.length) return { none: true };
  const tip = chainTop(appRepo, all, rows);
  const listed = all.map((c) => c.name + ' ' + c.sha.slice(0, 9)).join(', ');
  if (!tip) return { fault: { code: 'workflow-custody-diverged', detail: `the refs of ${workflowId} do not form one chain: ${listed}` } };
  const branchTip = chainTop(appRepo, branches, rows) ?? { name: null, sha: lastCheckpoint(appRepo, rows, tip) };
  const above = tip.kind === 'preserved' && tip.sha !== branchTip.sha;
  return { branchTip, tip, restore: above ? tip.sha : null, preservedRef: above ? tip.name : null };
}

const diverged = (detail) => ({ ok: false, reason: 'workflow-custody-diverged', detail });
const conflict = (detail) => ({ ok: false, reason: 'workflow-custody-conflict', detail });
const outcome = (r) => String(r.stderr || r.stdout || r.error?.message || '').trim().slice(0, 300);

/** In `dir`, a tree whose HEAD is an ancestor of the chain: HEAD moved to the tip, the preserved change left as uncommitted work. */
function moveTreeToTip(dir, custody) {
  const ff = merge(['--ff-only', custody.tip.sha], { cwd: dir });
  if (ff.status !== 0) return conflict(`${dir} cannot fast-forward to ${custody.tip.name} ${custody.tip.sha}: ${outcome(ff)}`);
  if (!custody.restore) return { ok: true };
  const back = reset(['--mixed', custody.branchTip.sha], { cwd: dir });
  return back.status === 0 ? { ok: true } : conflict(`${dir} cannot restore the preserved work above ${custody.branchTip.sha}: ${outcome(back)}`);
}

// The collector's ref, kept under a name that marks it restored: its content stays reachable, and the next pass finds nothing left to restore.
function retirePreserved(appRepo, workflowId, custody) {
  if (!custody.preservedRef) return;
  const kept = updateRef(appRepo, refOf(`${PRESERVED_PREFIX}/${workflowId}/restored-${custody.restore.slice(0, 12)}`), custody.restore);
  if (kept.ok) branchDelete({ repoRoot: appRepo, branch: custody.preservedRef, mode: 'force' });
}

/** A restore (and its retirement of the preserved ref) for a tree just made at the branch tip, or none needed. {ok} | {ok:false, reason, detail} */
export function restorePreserved({ appRepo, workflowId, dir, custody }) {
  if (!custody.restore) return { ok: true };
  const moved = moveTreeToTip(dir, custody);
  if (moved.ok) retirePreserved(appRepo, workflowId, custody);
  return moved;
}

/**
 * Where a registered tree stands against the chain, read only: {head, state}: 'attached' (HEAD contains the last checkpoint and
 * nothing is left to restore), 'behind' (HEAD is an ancestor of the tip: it can be moved), 'diverged' (it holds commits off the chain).
 */
export function treeStateOf({ dir, custody }) {
  const head = revParse(dir, 'HEAD');
  if (!head) return { head: null, state: 'diverged' };
  if (!custody.restore && isAncestor(dir, custody.branchTip.sha, head)) return { head, state: 'attached' };
  return { head, state: isAncestor(dir, head, custody.tip.sha) ? 'behind' : 'diverged' };
}

/**
 * A registered tree against the chain. {ok, repaired:false} when it is attached; else its own uncommitted work is preserved
 * (preserved/<id>/wrong-tree) and it is moved to the tip: {ok, repaired:true, from, to, wrongTree: ref|null}; a tree with
 * commits off the chain, or one that cannot move, is refused.
 */
export function repairRegisteredTree({ appRepo, workflowId, dir, custody }) {
  const { head, state } = treeStateOf({ dir, custody });
  if (state === 'attached') return { ok: true, repaired: false };
  if (state === 'diverged') return diverged(`${dir} holds commits of its own (${head}) that are not on the chain of ${workflowId} (${custody.tip.name} ${custody.tip.sha})`);
  const saved = preserveWork({ repoRoot: appRepo, dir, name: `${workflowId}/wrong-tree` });
  if (!saved.ok) return conflict(`${dir}: its uncommitted work could not be preserved (${saved.step ?? saved.reason})`);
  const moved = moveTreeToTip(dir, custody);
  if (!moved.ok) return moved;
  retirePreserved(appRepo, workflowId, custody);
  return { ok: true, repaired: true, from: head, to: custody.tip.sha, wrongTree: saved.ref ?? null };
}
