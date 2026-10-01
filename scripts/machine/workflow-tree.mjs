// workflow-tree.mjs - the host registry's view of a workflow's worktree (machine.sqlite worktrees, kind workflow) and the
// base an op's gate measures against there. Read by the Kernel (scripts/kernel/workflow-worktree.mjs,
// workflow-checkpoint.mjs) and by scripts/gates/gate.mjs, which finds its workflow from the directory it runs in.
import fs from 'node:fs';
import path from 'node:path';
import { mergeBase } from '../api/git/merge-base.mjs';
import { revParse as gitRevParse } from '../api/git/rev-parse.mjs';
import { withMachine } from '../../engine/db/machine.mjs';

const SHA = /^[0-9a-f]{40,64}$/;
const insidePath = (child, parent) => { const rel = path.relative(path.resolve(parent), path.resolve(child)); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };
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
  } catch { return null; }
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
  } catch { return null; }
}

/** The registry functions a caller may replace (ctx.worktree in a spec, the functions above in the runtime). */
const registryOf = (ctx) => ({ workflowWorktreeOf, workflowWorktreeAt, ...(ctx?.worktree ?? {}) });

/** The registry record of the workflow's worktree, its directory present: {workflowId, orcaWorktreeId, path, branch, checkpoint}. */
function presentRecordOf(ctx, workflowId) {
  const rec = registryOf(ctx).workflowWorktreeOf(ctx, workflowId);
  if (!rec) throw fail({ code: 'workflow-worktree-missing' }, `workflow ${workflowId} has no workflow worktree in the registry`);
  if (!rec.path || !fs.existsSync(rec.path)) throw fail({ code: 'workflow-worktree-missing' }, `the worktree of workflow ${workflowId} (${rec.path ?? '-'}) is gone`);
  if (!rec.branch) throw fail({ code: 'workflow-worktree-missing' }, `the registry records no branch for the worktree of workflow ${workflowId} (${rec.path})`);
  return rec;
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
