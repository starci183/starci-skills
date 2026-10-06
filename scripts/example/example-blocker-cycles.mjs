// example-blocker-cycles.mjs — the blocker-cycles section of the `.starciwork` critique
// (example-critique.mjs): a blockedBy ring never resolves on its own, so each strongly connected
// component is reported with the deterministic ring example-critique renders.
import {isPlainObject} from '../../engine/plain-object.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import {indexInlineCriteria, resolveRecordRef} from '../work/record-ownership.mjs';

/** Tarjan's algorithm, iterative in spirit but written recursively (these graphs are small); node and edge
 * order are both sorted first, so two runs over the same tree produce byte-identical SCCs and the same
 * chosen ring. Only edges between two nodes in `candidateIds` are considered - the cycle detector should not
 * wander into the whole tree's blockedBy graph, only the part example-derive.mjs already flagged `cyclic`. */
function stronglyConnectedComponents(candidateIds, edgesOf) {
  const ids = [...candidateIds].sort(byCodeUnit);
  const index = new Map(), lowlink = new Map(), onStack = new Set(), stack = [];
  const sccs = [];
  let counter = 0;
  function strongconnect(v) {
    index.set(v, counter); lowlink.set(v, counter); counter += 1;
    stack.push(v); onStack.add(v);
    for (const w of [...edgesOf(v)].filter(x => candidateIds.has(x)).sort(byCodeUnit)) {
      if (!index.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), index.get(w)));
      }
    }
    if (lowlink.get(v) === index.get(v)) {
      const component = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); component.push(w); } while (w !== v);
      component.sort(byCodeUnit);
      sccs.push(component);
    }
  }
  for (const v of ids) if (!index.has(v)) strongconnect(v);
  return sccs;
}

/** One concrete simple cycle through `scc`, starting at its lexicographically smallest member and
 * preferring the smallest available neighbor at each step (deterministic). Tries a full-coverage
 * (Hamiltonian) cycle first - a ring that visits every member is the more informative report of "what is
 * actually stuck together" than the shortest possible loop through just two of them - and falls back to the
 * shortest cycle it can find if no full-coverage ring exists. `scc` is strongly connected, so at least the
 * fallback is guaranteed to succeed. */
function findRingIn(scc, edgesOf) {
  if (scc.length === 1) return [scc[0], scc[0]]; // self-loop
  const members = new Set(scc);
  const start = [...scc].sort(byCodeUnit)[0];
  const neighborsOf = node => [...edgesOf(node)].filter(n => members.has(n)).sort(byCodeUnit);

  function fullCoverageRing() {
    const path = [start];
    const visited = new Set([start]);
    function dfs(node) {
      if (path.length === scc.length) return neighborsOf(node).includes(start);
      for (const n of neighborsOf(node)) {
        if (visited.has(n)) continue;
        path.push(n); visited.add(n);
        if (dfs(n)) return true;
        path.pop(); visited.delete(n);
      }
      return false;
    }
    return dfs(start) ? [...path, start] : null;
  }

  function shortestRing() {
    const path = [start];
    const onPath = new Set([start]);
    function dfs(node) {
      const neighbors = neighborsOf(node);
      if (neighbors.includes(start) && path.length > 1) return true;
      for (const n of neighbors) {
        if (n === start || onPath.has(n)) continue;
        path.push(n); onPath.add(n);
        if (dfs(n)) return true;
        path.pop(); onPath.delete(n);
      }
      return false;
    }
    dfs(start);
    return [...path, start];
  }

  return fullCoverageRing() ?? shortestRing();
}

/** One blocker-cycle finding: the ring's edges, why they never resolve on their own, and the anchor hint
 * the feature already offers (a gap or an open decision a ring member could point at instead). */
const blockerCycleFinding = (scc, { edgesOf, canon, derived, rawRecords }) => {
  const ring = findRingIn(scc, edgesOf);
  const because = [];
  for (let i = 0; i < ring.length - 1; i += 1) {
    const from = ring[i], to = ring[i + 1];
    const raw = rawRecords.get(from);
    const edge = (Array.isArray(raw?.data.blockedBy) ? raw.data.blockedBy : []).find(e => isPlainObject(e) && canon(e.record) === to);
    const clipped = edge?.because ? edge.because.slice(0, 90) + (edge.because.length > 90 ? '...' : '') : null;
    because.push(`${from} is blockedBy ${to}${clipped ? ' ("' + clipped + '")' : ''}`);
  }
  const features = new Set(scc.map(id => derived.records.get(id)?.feature).filter(Boolean));
  const candidateAnchors = [...rawRecords.values()]
    .filter(r => features.has(r.feature) && !scc.includes(r.id))
    .filter(r => r.schema === 'work/gap@1' || (r.schema === 'work/policy-decision@1' && r.data.outcome === 'open'))
    .map(r => r.id).sort(byCodeUnit);
  const anchorsNote = candidateAnchors.length
    ? `Candidate anchors already in the tree for the same feature(s) that no ring member currently points at: ${candidateAnchors.join(', ')} - one of the ring's records should point outward at one of these instead of at another ring member.`
    : 'No gap or open decision exists yet for the same feature(s); one needs to be authored so a ring member can point outward instead of at another ring member.';
  return {
    id: `blocker-cycle:${scc[0]}`,
    kind: 'blocker-cycle',
    severity: 'critical',
    records: scc,
    because: `A blockedBy ring never reaches a gap or an open decision: ${ring.join(' → ')}. It never resolves on its own. ${anchorsNote} Edges: ${because.join('; ')}.`,
  };
};

export function computeBlockerCycleFindings(derived, rawRecords) {
  const inline = indexInlineCriteria(rawRecords);
  const canon = ref => resolveRecordRef(rawRecords, ref, inline) ?? ref;
  const candidateIds = new Set();
  for (const rec of derived.records.values()) {
    if (rec.blockers.some(b => b.cyclic)) {
      candidateIds.add(rec.id);
      for (const b of rec.blockers) if (b.cyclic) candidateIds.add(b.id);
    }
  }
  const edgesOf = id => {
    const raw = rawRecords.get(id);
    const edges = Array.isArray(raw?.data.blockedBy) ? raw.data.blockedBy : [];
    return edges.filter(e => isPlainObject(e) && typeof e.record === 'string').map(e => canon(e.record));
  };
  const sccs = stronglyConnectedComponents(candidateIds, edgesOf).filter(c => c.length > 1);
  sccs.sort((a, b) => a[0].localeCompare(b[0]));
  return sccs.map(scc => blockerCycleFinding(scc, { edgesOf, canon, derived, rawRecords }));
}
