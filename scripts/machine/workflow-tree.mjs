// workflow-tree.mjs - the host registry's view of a workflow's worktree (machine.sqlite worktrees, kind workflow) and the
// base an op's gate measures against there. Read by the Kernel (scripts/kernel/workflow-worktree.mjs,
// workflow-checkpoint.mjs) and by scripts/gates/gate.mjs, which finds its workflow from the directory it runs in.
import fs from 'node:fs';
import path from 'node:path';
import { mergeBase } from '../api/git/merge-base.mjs';
import { diffNames } from '../api/git/diff-names.mjs';
import { revParse as gitRevParse } from '../api/git/rev-parse.mjs';
import { withMachine } from '../../engine/db/machine.mjs';
import { isInside } from '../lib/walk.mjs';
import { requireWorktreeRecord } from '../lib/worktree-record.mjs';

const SHA = /^[0-9a-f]{40,64}$/;
const insidePath = (child, parent) => isInside(path.resolve(parent), path.resolve(child));
const fail = ({ code }, message) => Object.assign(new Error(message), { code });
const revParse = (cwd, ref) => { const sha = gitRevParse(cwd, ref); return sha && SHA.test(sha) ? sha : null; };
const mainOf = (ctx) => ctx?.main ?? 'main';
const envOf = (ctx) => ctx?.env ?? process.env;

/** A registry row of a workflow worktree as a record: {workflowId, orcaWorktreeId, path, branch, checkpoint, repoRoot, ...}, or null. */
export const workflowRecordOf = (row) => (row ? { workflowId: row.workflow_id, orcaWorktreeId: row.orca_id, path: path.resolve(row.path), branch: row.branch ?? null,
  checkpoint: row.checkpoint_sha ?? null, repoRoot: row.repo_root, ledgerId: row.ledger_id ?? null, createdAt: row.created_at,
  releasePending: row.release_pending_at != null } : null);

/** The live workflow worktree of `workflowId`: {workflowId, orcaWorktreeId, path, branch, checkpoint, repoRoot}, or null. */
export function workflowWorktreeOf(ctx, workflowId) {
  const env = envOf(ctx);
  try {
    return workflowRecordOf(withMachine((m) => m.db.prepare("SELECT * FROM worktrees WHERE kind='workflow' AND workflow_id=? AND orca_id IS NOT NULL AND removed_at IS NULL ORDER BY created_at DESC LIMIT 1").get(workflowId), { env }));
  } catch (cause) { throw Object.assign(new Error(`the workflow worktree registry is unavailable: ${cause.message}`, { cause }), { code: 'worktree-registry-unavailable' }); }
}

/**
 * The live workflow worktree whose directory is `dir` (or holds it), or null: how a tool run inside a worktree
 * (scripts/gates/gate.mjs) finds its workflow through the registry, never by parsing a branch or folder name.
 */
export function workflowWorktreeAt(ctx, dir) {
  const env = envOf(ctx);
  const at = path.resolve(dir);
  const key = (p) => { let r = path.resolve(p); try { r = fs.realpathSync.native(r); } catch { /* missing */ } return process.platform === 'win32' ? r.toLowerCase() : r; };
  try {
    const rows = withMachine((m) => m.db.prepare("SELECT * FROM worktrees WHERE kind='workflow' AND orca_id IS NOT NULL AND removed_at IS NULL ORDER BY created_at DESC").all(), { env });
    const row = rows.find((r) => key(r.path) === key(at)) ?? rows.find((r) => insidePath(key(at), key(r.path)));
    return workflowRecordOf(row ?? null);
  } catch (cause) { throw Object.assign(new Error(`the workflow worktree registry is unavailable: ${cause.message}`, { cause }), { code: 'worktree-registry-unavailable' }); }
}

/** The registry functions a caller may replace (ctx.worktree in a spec, the functions above in the runtime). */
const registryOf = (ctx) => ({ workflowWorktreeOf, workflowWorktreeAt, ...(ctx?.worktree ?? {}) });

/** The registry record of the workflow's worktree, its directory present: {workflowId, orcaWorktreeId, path, branch, checkpoint}. */
function presentRecordOf(ctx, workflowId) {
  return requireWorktreeRecord(registryOf(ctx).workflowWorktreeOf(ctx, workflowId), workflowId);
}

/**
 * The gate base of the workflow worktree that holds `dir` (part A's workflowWorktreeAt over the registry), or null when
 * `dir` is no workflow worktree: scripts/gates/gate.mjs measures an op there against its previous checkpoint.
 */
export function gateBaseAt(ctx, dir) {
  const rec = registryOf(ctx).workflowWorktreeAt(ctx, dir);
  return rec ? gateBaseOf(ctx, rec.workflowId) : null;
}

/** The base an op's gate measures against: the previous checkpoint, else the merge-base of the workflow branch with main. */
export function gateBaseOf(ctx, workflowId) {
  const rec = presentRecordOf(ctx, workflowId);
  if (rec.checkpoint) {
    const sha = revParse(rec.path, rec.checkpoint);
    if (!sha) throw fail({ code: 'workflow-gate-base-unknown' }, `the checkpoint ${rec.checkpoint} of workflow ${workflowId} is not a commit of ${rec.path}`);
    return sha;
  }
  const base = mergeBase(rec.path, `refs/heads/${mainOf(ctx)}`, 'HEAD') ?? '';
  if (!SHA.test(base)) throw fail({ code: 'workflow-gate-base-unknown' }, `workflow ${workflowId} has no checkpoint and ${rec.branch} has no merge-base with ${mainOf(ctx)}`);
  return base;
}

const CHAIN_WALK_MAX = 64;
/**
 * The bases an op's gate may have measured against, newest first (per side, WFWT2 2.2): the current checkpoint, then each
 * older checkpoint of the chain while the checkpoint stepped over changed none of `owned` (the op's owned paths, the
 * leases checkpointOp commits), stopping at the chain's start (the merge-base with main). A be checkpoint committed while
 * an fe op ran therefore never forces the fe op to re-run its gate: what differs between the bases is the other side's
 * committed, gated work, and the finish gates the whole branch again. An op that owns no path or owns '.' gets the current
 * checkpoint only.
 */
export function gateBasesOf(ctx, workflowId, { owned = [] } = {}) {
  const current = gateBaseOf(ctx, workflowId);
  const paths = owned.map(String).filter(Boolean);
  if (!paths.length || paths.some((p) => p === '.' || p === './')) return [current];
  const rec = presentRecordOf(ctx, workflowId);
  const root = mergeBase(rec.path, `refs/heads/${mainOf(ctx)}`, current);
  const bases = [current];
  for (let at = current; at !== root && bases.length < CHAIN_WALK_MAX;) {
    const parent = revParse(rec.path, `${at}^`);
    if (!parent) break;
    const touched = diffNames(rec.path, parent, at, { paths: paths.map((p) => `:(literal)${p}`) });
    if (touched === null || touched.length) break;
    bases.push(parent);
    at = parent;
  }
  return bases;
}
