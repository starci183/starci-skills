// worktree-record.mjs — the workflow-worktree registry row a checkpoint or a gate needs.
import fs from 'node:fs';

/**
 * `rec` must be `workflowId`'s live worktree row: present in the registry, its path on disk, a branch
 * recorded. Throws {code: 'workflow-worktree-missing'} otherwise; returns `rec`.
 */
export function requireWorktreeRecord(rec, workflowId) {
  const missing = (message) => { throw Object.assign(new Error(message), { code: 'workflow-worktree-missing' }); };
  if (!rec) missing(`workflow ${workflowId} has no workflow worktree in the registry`);
  if (!rec.path || !fs.existsSync(rec.path)) missing(`the worktree of workflow ${workflowId} (${rec.path ?? '-'}) is gone`);
  if (!rec.branch) missing(`the registry records no branch for the worktree of workflow ${workflowId} (${rec.path})`);
  return rec;
}
