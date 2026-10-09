// gc-tree-strays.mjs — key gc:tree-strays of the GC controller: the files in the root of a live workflow tree that no job owns (scripts/machine/tree-strays.mjs).
// Shadow (the controller's default): one reconciler.would row per tree with the plan; active: the strays are removed and every one is journalled as a
// reconciler.gc.tree-strays row and a gc_items row. Never a tracked file, never a path a live job owns.
import path from 'node:path';
import { claimDue, finishDuty } from './schedules.mjs';
import { mapInOrder } from '../lib/in-order.mjs';
import { strayFilesOf, removeStrays } from '../machine/tree-strays.mjs';
import { readMachine } from '../../engine/db/machine.mjs';
import { ledgerFileFor, openLedgerReader } from '../../engine/db/ledger.mjs';

const COLLECTOR = 'gc-tree-strays';
const LIVE = ['queued', 'ready', 'leased', 'running', 'answering', 'reported', 'deciding', 'effect_unknown'];

/** The live host reads of the key: the registered workflow trees, and the paths the live jobs of one workflow own. */
export const treeStrayDeps = {
  workflowTrees: async (ctx) => readMachine((m) => m.db.prepare("SELECT workflow_id, path, repo_root FROM worktrees WHERE kind='workflow' AND removed_at IS NULL AND orca_id IS NOT NULL").all()
    .map((row) => ({ workflowId: row.workflow_id, path: path.resolve(row.path), repo: row.repo_root })), [], { env: ctx.env ?? process.env }),
  ownedPaths: async (repo, workflowId) => {
    const ledger = openLedgerReader(ledgerFileFor(path.resolve(repo)));
    try {
      return ledger.prepare(`SELECT payload_json FROM jobs WHERE workflow_id=? AND status IN (${LIVE.map(() => '?').join(',')})`).all(workflowId, ...LIVE)
        .flatMap((row) => (JSON.parse(row.payload_json ?? '{}').owned_paths ?? []).map((owned) => (typeof owned === 'string' ? owned : owned?.path)).filter(Boolean));
    } finally { ledger.close?.(); }
  },
};

/** The key's reconcile: `deps.workflowTrees()` -> [{workflowId, path, repo}], `deps.ownedPaths(repo, workflowId)` -> live owned paths, `deps.recordRun` as the worktrees key. */
export async function reconcileTreeStrays(ctx, { settings, deps, name, would }) {
  const now = ctx.now();
  const claim = claimDue(ctx, { controller: name, duty: 'tree-strays', intervalMs: settings.treeStraysEveryMs, now });
  if (!claim.due) return { skipped: 'not due', nextAt: claim.nextAt ?? null };
  const judged = await mapInOrder(await deps.workflowTrees(ctx), async (tree) => {
    const plan = strayFilesOf({ tree: tree.path, owned: await deps.ownedPaths(tree.repo, tree.workflowId), now, minAgeMs: settings.treeStrayMinAgeMs, maxBytes: settings.treeStrayMaxBytes });
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
