// gc-tree-strays.mjs — key gc:tree-strays of the GC controller: the files in the root of a live workflow tree that no job owns (scripts/machine/tree-strays.mjs).
// Shadow (the controller's default): one reconciler.would row per tree with the plan; active: the strays are removed and every one is journalled as a
// reconciler.gc.tree-strays row and a gc_items row. Never a tracked file, never a path a live job owns.
import path from 'node:path';
import { claimDue, finishDuty } from './schedules.mjs';
import { mapInOrder } from '../lib/in-order.mjs';
import { strayFilesOf, removeStrays } from '../machine/tree-strays.mjs';
import { readMachine } from '../../engine/db/machine.mjs';

const COLLECTOR = 'gc-tree-strays';
const LIVE = ['queued', 'ready', 'leased', 'running', 'answering', 'reported', 'deciding', 'effect_unknown'];

/** The live host reads of the key: the registered workflow trees, and the paths the live jobs of one workflow own. */
export const treeStrayDeps = {
  workflowTrees: async (ctx) => readMachine((m) => m.db.prepare("SELECT workflow_id, path, repo_root FROM worktrees WHERE kind='workflow' AND removed_at IS NULL AND orca_id IS NOT NULL").all()
    .map((row) => ({ workflowId: row.workflow_id, path: path.resolve(row.path), repo: row.repo_root })), [], { env: process.env }),
  // null when no ledger of the controller knows the workflow: ownership is unknown and the tree is left alone. The registry's repo_root names the ledger's repository when it can.
  ownedPaths: async (repo, workflowId, ctx) => {
    const same = (l) => l.repo && path.resolve(l.repo) === path.resolve(repo);
    const candidates = [...(ctx.ledgers ?? []).filter(same), ...(ctx.ledgers ?? []).filter((l) => !same(l))];
    for (const candidate of candidates) {
      const owned = ctx.read(candidate.ledgerId, (db) => {
        if (!db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(workflowId)) return null;
        return db.prepare(`SELECT payload_json FROM jobs WHERE workflow_id=? AND kind='op' AND status IN (${LIVE.map(() => '?').join(',')})`).all(workflowId, ...LIVE)
          .flatMap((row) => (JSON.parse(row.payload_json ?? '{}').owned_paths ?? []).map((entry) => (typeof entry === 'string' ? entry : entry?.path)).filter(Boolean));
      });
      if (owned) return owned;
    }
    return null;
  },
};

/** The key's reconcile: `deps.workflowTrees()` -> [{workflowId, path, repo}], `deps.ownedPaths(repo, workflowId)` -> live owned paths, `deps.recordRun` as the worktrees key. */
export async function reconcileTreeStrays(ctx, { settings, deps, name, would }) {
  const now = ctx.now();
  const claim = claimDue(ctx, { controller: name, duty: 'tree-strays', intervalMs: settings.treeStraysEveryMs, now });
  if (!claim.due) return { skipped: 'not due', nextAt: claim.nextAt ?? null };
  const judged = await mapInOrder(await deps.workflowTrees(ctx), async (tree) => {
    const owned = await deps.ownedPaths(tree.repo, tree.workflowId, ctx);
    if (owned === null) return null;
    const plan = strayFilesOf({ tree: tree.path, owned, now, minAgeMs: settings.treeStrayMinAgeMs, maxBytes: settings.treeStrayMaxBytes });
    return plan.length ? { tree, plan, removed: ctx.mode === 'active' ? removeStrays(tree.path, plan) : null } : null;
  });
  const found = judged.filter(Boolean);
  for (const { tree, plan, removed } of found) {
    if (removed) ctx.log('reconciler.gc.tree-strays', `${tree.workflowId}: ${removed.filter((r) => r.ok).length} stray file(s) removed from ${path.basename(tree.path)}`, { controller: name, workflowId: tree.workflowId, items: removed });
    else would(ctx, 'tree-strays', tree.workflowId, { plan });
  }
  if (ctx.mode === 'active' && found.length) {
    await deps.recordRun({ trigger: 'sweep', items: found.flatMap(({ tree, removed }) => removed.map((r) => ({ collector: COLLECTOR, kind: 'file', target: path.join(tree.path, r.name), ownerRef: tree.workflowId,
      action: r.ok ? 'removed' : 'failed', reason: 'untracked file in a workflow tree root that no live job owns', outcome: r.ok ? 'done' : 'gave-up', ...(r.ok ? { verifiedGoneAt: ctx.now() } : { lastError: r.error }) }))) });
  }
  finishDuty(ctx, { controller: name, duty: 'tree-strays', result: ctx.mode === 'active' ? 'done' : 'skipped', now: ctx.now() });
  return { trees: found.length, strays: found.reduce((n, f) => n + f.plan.length, 0), applied: ctx.mode === 'active' };
}
