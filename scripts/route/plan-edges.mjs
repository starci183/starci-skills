// plan-edges.mjs — the dependency graph of a workflow's approved legs.
//
// route-plan.mjs emits `edges` [[fromLeg, toLeg], ...] over leg labels
// (`op` or `op#instance`); define-goal persists them as goals.json
// opChain.edges and derivedPlan.edges; `starci kernel plan` replaces derivedPlan with the
// Kernel's plan, whose own edges are required. The runtime keys legs by op id
// (jobs carry op_id), so this module collapses labels to op ids. A plan without
// provable edges is refused (plan-edges-missing); there is no linear fallback.

const opOfLabel = (label) => String(label).split('#')[0];
const legOp = (leg) => (typeof leg === 'string' ? opOfLabel(leg) : leg?.op ? String(leg.op) : null);

/** Ordered, de-duplicated op ids of a leg list. */
const legOpsOf = (legs) => (Array.isArray(legs) ? [...new Set(legs.map(legOp).filter(Boolean))] : []);

/** Op-level edges from label edges over exactly `ops`; null when malformed, partial or cyclic. */
function collapseEdges(raw, ops) {
  if (!Array.isArray(raw)) return null;
  const known = new Set(ops);
  const out = new Map();
  for (const edge of raw) {
    if (!Array.isArray(edge) || edge.length !== 2) return null;
    const [from, to] = edge.map(opOfLabel);
    if (!known.has(from) || !known.has(to)) return null;
    if (from !== to) out.set(`${from}\u0000${to}`, [from, to]);
  }
  const edges = [...out.values()];
  // A leg no edge touches is a leg the edges were not derived for.
  const touched = new Set(edges.flat());
  if (ops.length > 1 && ops.some((op) => !touched.has(op))) return null;
  return isAcyclic(ops, edges) ? edges : null;
}

function isAcyclic(ops, edges) {
  const indeg = new Map(ops.map((op) => [op, 0]));
  for (const [, to] of edges) indeg.set(to, indeg.get(to) + 1);
  const ready = ops.filter((op) => indeg.get(op) === 0);
  let seen = 0;
  while (ready.length) {
    const op = ready.pop();
    seen++;
    for (const [from, to] of edges) if (from === op) {
      indeg.set(to, indeg.get(to) - 1);
      if (indeg.get(to) === 0) ready.push(to);
    }
  }
  return seen === ops.length;
}

/**
 * The approved leg graph of a goal: {ops, edges, source}. `plan` is goals.json
 * (its derivedPlan) or a bare plan {legs, edges}. The edges are the plan's own
 * and only they: a plan of several legs without provable edges (absent,
 * partial, unknown leg or cyclic) is the typed refusal `plan-edges-missing`.
 */
export function planGraphOf(plan) {
  const isGoal = plan && typeof plan === 'object' && ('derivedPlan' in plan || 'opChain' in plan);
  const primary = isGoal ? plan.derivedPlan : plan;
  const ops = legOpsOf(primary?.legs);
  if (!ops.length) {
    if (isGoal && legOpsOf(plan.opChain?.legs).length) throw Object.assign(new Error('plan-edges-missing: the goal holds an opChain but no derivedPlan with edges; a plan without edges is refused'), { code: 'plan-edges-missing' });
    return { ops, edges: [], source: isGoal ? 'derivedPlan' : 'plan' };
  }
  // A single leg has no edges to prove; several legs must carry their own.
  const own = ops.length === 1 && primary.edges === undefined ? [] : collapseEdges(primary?.edges, ops);
  if (!own) throw Object.assign(new Error(`plan-edges-missing: the plan's ${ops.length} leg(s) [${ops.join(', ')}] carry no provable dependency edges (absent, partial, naming an unknown leg or cyclic); a plan without edges is refused`), { code: 'plan-edges-missing' });
  return { ops, edges: own, source: isGoal ? 'derivedPlan' : 'plan' };
}

/** Op-level dependency edges [[fromOp, toOp], ...] of a goal or plan. */
export const planEdgesOf = (plan) => planGraphOf(plan).edges;

/**
 * Transitive predecessors of every leg: Map<op, op[]> in leg order. A leg is
 * held by any ancestor with a job still open, not only its direct parents — an
 * ancestor whose child was never enqueued still precedes it.
 */
export function planAncestorsOf(plan) {
  const { ops, edges } = planGraphOf(plan);
  const parents = new Map(ops.map((op) => [op, []]));
  for (const [from, to] of edges) parents.get(to).push(from);
  const memo = new Map();
  const walk = (op) => {
    if (memo.has(op)) return memo.get(op);
    const acc = new Set();
    for (const parent of parents.get(op)) { acc.add(parent); for (const up of walk(parent)) acc.add(up); }
    memo.set(op, acc);
    return acc;
  };
  return new Map(ops.map((op) => [op, ops.filter((other) => walk(op).has(other))]));
}
