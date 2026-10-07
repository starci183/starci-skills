// The blocker graph rule of the example Work standard (check-example-work.mjs): blockers form a DAG rooted in gaps
// or open decisions.
import { resolveRecordRef } from '../record-ownership.mjs';

/** DFS from `startId` looking for a path back to `startId` itself, one step: returns the cycle as an array of ids
 * (startId ... startId) or null. */
function cycleStep(current, startId, state, { resolveMap, blockedByOf }) {
  state.visited.add(current);
  state.path.push(current);
  for (const next of blockedByOf(resolveMap.get(current))) {
    if (!resolveMap.has(next)) continue;
    if (next === startId) return [...state.path, next];
    if (state.visited.has(next)) continue;
    const found = cycleStep(next, startId, state, { resolveMap, blockedByOf });
    if (found) return found;
  }
  state.path.pop();
  return null;
}

/** DFS from `startId` looking for a path back to `startId` itself. Returns the cycle as an array of ids
 * (startId ... startId) or null. O(V*(V+E)) run once per record is fine at this tree's size (a few
 * hundred records), and keeps the algorithm obviously correct rather than a from-scratch Tarjan. */
const cyclePathFrom = (startId, graph) => cycleStep(startId, startId, { visited: new Set(), path: [] }, graph);

/** Visits one `blockedBy` target of a root search: a gap, an open decision or a dead end is a root, a dangling
 * ref is `missing`, a revisit is `cyclic`, anything else continues through its own edges. */
function visitRootEdge(targetId, visited, roots, { resolveMap, blockedByOf }) {
  if (roots.has(targetId)) return;
  const target = resolveMap.get(targetId);
  if (!target) { roots.set(targetId, 'missing'); return; } // dangling ref already caught elsewhere
  if (visited.has(targetId)) { roots.set(targetId, 'cyclic'); return; }
  const isGap = target.schema === 'work/gap@1';
  const isOpenDecision = target.schema === 'work/policy-decision@1' && target.data?.outcome === 'open';
  const subEdges = blockedByOf(target);
  if (isGap || isOpenDecision || !subEdges.length) {
    roots.set(targetId, (isGap && 'gap') || (isOpenDecision && 'decision') || 'record');
    return;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(targetId);
  for (const sub of subEdges) visitRootEdge(sub, nextVisited, roots, { resolveMap, blockedByOf });
}

/** Every direct or transitive `blockedBy` root reachable from `startId`, stopping at a gap, an open
 * decision, a cycle back into the walk, or a dead end with no further blockedBy of its own - the same
 * shape scripts/example/example-derive.mjs's own resolveBlockers computes, reimplemented here (not imported: this
 * module and example-derive.mjs already import from each other in the other direction, and importing
 * back would create a cycle in the module graph itself, not just the data). Returns a Map(id -> kind),
 * kind one of gap|decision|record|cyclic|missing. */
function rootsFrom(startId, graph) {
  const roots = new Map();
  for (const edge of graph.blockedByOf(graph.resolveMap.get(startId))) visitRootEdge(edge, new Set([startId]), roots, graph);
  return roots;
}

// ---- trust concept 5: blockers form a DAG rooted in gaps or open decisions ----
// `blockedBy` is meant to explain *why* work waits, and the layout says the honest root of a wait is
// either a `work/gap@1` (a named absence) or an open `work/policy-decision@1` - never a loop back on itself.
// A cycle is a structural impossibility (nothing can wait on something that is waiting on it) and is
// refused (BLOCKER_CYCLE). A chain that dead-ends at an ordinary record - neither a cycle nor a gap/open-
// decision root - is not refused: this example tree currently has roughly a dozen such chains across
// several features (an implementation waiting on another implementation that itself has not landed,
// with no gap ever authored for the absence), and refusing every one of them tree-wide would be a much
// larger red surface than this lane is scoped to fix record-by-record. It is warned (BLOCKER_UNROOTED)
// instead, naming the actual unrooted target, so the fact is visible without forcing a gap to be
// authored for every such chain in one sweep.
export function checkBlockerGraph({ problems, warnings, records, resolveMap, resolveInline }) {
  const blockedByOf = rec => Array.isArray(rec?.data?.blockedBy)
    ? rec.data.blockedBy.filter(e => e && typeof e === 'object' && typeof e.record === 'string')
      .map(e => resolveRecordRef(resolveMap, e.record, resolveInline) ?? e.record)
    : [];
  const graph = { resolveMap, blockedByOf };
  reportBlockerCycles(records, graph, problems);
  reportUnrootedBlockers(records, graph, warnings);
}

function reportBlockerCycles(records, graph, problems) {
  const cyclicAlready = new Set();
  for (const [id, rec] of records) {
    if (!graph.blockedByOf(rec).length || cyclicAlready.has(id)) continue;
    const cycle = cyclePathFrom(id, graph);
    if (cycle) {
      for (const member of cycle) cyclicAlready.add(member);
      problems.push(`${rec.shown}: blockedBy forms a cycle: ${cycle.join(' -> ')} [BLOCKER_CYCLE]`);
    }
  }
}

function reportUnrootedBlockers(records, graph, warnings) {
  for (const [id, rec] of records) {
    if (!graph.blockedByOf(rec).length) continue;
    for (const [rootId, kind] of rootsFrom(id, graph)) {
      if (kind === 'record') {
        warnings.push(`${rec.shown}: blockedBy chain reaches ${rootId}, which is neither a work/gap@1 nor an open work/policy-decision@1 - the chain's real root is unnamed [BLOCKER_UNROOTED]`);
      }
    }
  }
}
