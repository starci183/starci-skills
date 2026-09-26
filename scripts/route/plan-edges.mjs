// plan-edges.mjs — the dependency graph of a workflow's approved legs.
//
// route-plan.mjs emits `edges` [[fromLeg, toLeg], ...] over leg labels
// (`op` or `op#instance`); define-goal persists them as goals.json
// opChain.edges and derivedPlan.edges. The runtime keys legs by op id (jobs
// carry op_id), so this module collapses labels to op ids. A plan without
// provable edges — a goal stored before edges existed, or a Kernel plan whose
// legs differ from the chain the edges describe — is the linear chain: every
// leg depends on the one before it.

const opOfLabel = (label) => String(label).split('#')[0];
const legOp = (leg) => (typeof leg === 'string' ? opOfLabel(leg) : leg?.op ? String(leg.op) : null);

/** Ordered, de-duplicated op ids of a leg list. */
export const legOpsOf = (legs) => (Array.isArray(legs) ? [...new Set(legs.map(legOp).filter(Boolean))] : []);

/** Linear chain over ordered ops: [[a,b],[b,c],...]. */
export const linearEdgesOf = (ops) => ops.slice(1).map((op, i) => [ops[i], op]);

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

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * The approved leg graph of a goal: {ops, edges, source}. `plan` is goals.json
 * (with derivedPlan / opChain) or a bare plan {legs, edges}. Sources, first
 * that holds: derivedPlan.edges over derivedPlan legs; opChain.edges when the
 * approved legs hold exactly the opChain's ops; else the linear chain.
 */
export function planGraphOf(plan) {
  const isGoal = plan && typeof plan === 'object' && ('derivedPlan' in plan || 'opChain' in plan);
  const primary = isGoal ? (plan.derivedPlan?.legs ? plan.derivedPlan : plan.opChain) : plan;
  const ops = legOpsOf(primary?.legs);
  const own = collapseEdges(primary?.edges, ops);
  if (own) return { ops, edges: own, source: isGoal ? (primary === plan.derivedPlan ? 'derivedPlan' : 'opChain') : 'plan' };
  if (isGoal && primary === plan.derivedPlan && sameSet(ops, legOpsOf(plan.opChain?.legs))) {
    const chain = collapseEdges(plan.opChain?.edges, ops);
    if (chain) return { ops, edges: chain, source: 'opChain' };
  }
  return { ops, edges: linearEdgesOf(ops), source: 'linear' };
}

/** Op-level dependency edges [[fromOp, toOp], ...] of a goal or plan; the linear chain for a plan without edges. */
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
