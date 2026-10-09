// untied-tree-item.mjs - trees under a runtime-managed root that no workflow owns (the GC's `unstamped-orphan` review items) reach the Supervisor as ONE Decision Item per
// repository: "K unregistered tree(s) under <root>: path, branch, last commit time, dirty or clean". The runtime removes nothing it did not create. The item is keyed by the
// repository and the set of paths; it closes by itself when the set changes or the trees are gone, and a `leave` answer keeps it closed for the same set.
import crypto from 'node:crypto';
import path from 'node:path';
import { mapInOrder } from '../lib/in-order.mjs';
import { supervisorDecisions } from '../machine/decisions.mjs';
import { withSupervisor } from '../machine/home.mjs';
import { untiedTreeFacts, untiedTreeLine } from '../machine/untied-tree.mjs';

const UNTIED_ITEM_KIND = 'unregistered-trees';
const LIVE = new Set(['open', 'claimed', 'escalated']);
const hashOf = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 10);

/** The groups of review items by repository: [{repo, key, trees: [{path, branch}]}]. Pure. */
export function untiedGroups(items) {
  const byRepo = Map.groupBy((items ?? []).filter((item) => item.reason === 'unstamped-orphan' && item.repoRoot), (item) => path.resolve(item.repoRoot));
  return [...byRepo].map(([repo, rows]) => {
    const trees = rows.map((row) => ({ path: row.path, branch: row.branch ?? null })).sort((a, b) => a.path.localeCompare(b.path));
    const digest = hashOf([repo, ...trees.map((t) => t.path)].join('\n'));
    return { repo, key: [UNTIED_ITEM_KIND, path.basename(repo), digest].join(':'), trees };
  });
}

/** The Decision Item of one group. Pure over the tree facts. */
export function untiedDecision(group, facts) {
  const lines = facts.map(untiedTreeLine);
  return {
    schema: 'starci/decision-item@1', kind: UNTIED_ITEM_KIND, decider: 'supervisor', ledger: 'supervisor', idempotencyKey: group.key,
    entity: { type: 'repository', id: group.repo }, openedBy: 'gc-controller', escalateTo: 'owner', allowedVerbs: [],
    summary: `${facts.length} unregistered tree(s) under ${group.repo}: ${lines.join('; ')}. The runtime cannot tie them to a workflow and removes nothing it did not create; removing one is a human act`,
    evidence: lines.map((line) => ({ ref: line })), refs: { repo: group.repo, paths: group.trees.map((t) => t.path) },
  };
}

/** The live items of this kind whose key is not among `wanted` (the set changed or the trees are gone). Pure. */
export const staleItems = (dis, wanted) => dis.filter((di) => di.kind === UNTIED_ITEM_KIND && LIVE.has(di.status) && !wanted.has(di.idempotencyKey));

/** Close those items on the machine writer `m`; the ids closed. */
function closeStale(m, wanted, now) {
  const stale = staleItems(supervisorDecisions(m, { now }), wanted);
  for (const di of stale) m.setSupDecision(di.id, { status: 'resolved', by: 'reconciler/gc', verb: 'trees-gone', rationale: 'the unregistered trees it listed are gone or the set changed' });
  return stale.map((di) => di.id);
}

/** One GC pass: open the item of each repository with untied trees, close the ones that no longer stand. `complete` = the pass saw every tree (it did not halt). */
export async function untiedTreesDecision(ctx, items, { complete = true } = {}) {
  const groups = untiedGroups(items);
  await mapInOrder(groups, (group) => ctx.openDecision(untiedDecision(group, group.trees.map(untiedTreeFacts))));
  if (complete && ctx.mode === 'active') withSupervisor((m) => closeStale(m, new Set(groups.map((g) => g.key)), ctx.now()), { env: ctx.env ?? process.env });
  return groups.length;
}
