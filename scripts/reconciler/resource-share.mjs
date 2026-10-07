// resource-share.mjs - the pure fair-share, starvation and quota-exhaustion judgements of the reconciler's Resource controller
// (controllers/resource.mjs re-exports them; DESIGN §8.3, §14).

/**
 * Per-workflow slot targets. `ops`: the worker census [{workflowId, status}] (queued rows included); `priorities`:
 * priorityTable(); `maxParallelOps`: the owner's ceiling (null: the total demand). Only workflows with ready (queued)
 * work get a target; the slots that workflows without ready work already hold are taken off the top. Reserve first
 * (weight order), then one slot at a time to the unsaturated workflow with the lowest target/weight (ties: higher
 * weight, then id), never above a workflow's demand (queued + running). Σ targets ≤ maxParallelOps.
 * {capacity, free, targets: {<workflowId>: {target, weight, reserve, running, queued, demand}}}.
 */
export function fairShare({ ops = [], priorities = {}, maxParallelOps = null }) {
  const by = new Map();
  for (const o of ops) {
    const id = o.workflowId ?? '(none)';
    const w = by.get(id) ?? { running: 0, queued: 0 };
    if (o.status === 'queued') w.queued += 1; else w.running += 1;
    by.set(id, w);
  }
  const demandTotal = [...by.values()].reduce((n, w) => n + w.running + w.queued, 0);
  const capacity = Number.isInteger(Number(maxParallelOps)) && Number(maxParallelOps) > 0 ? Number(maxParallelOps) : demandTotal;
  const heldElsewhere = [...by.values()].filter((w) => w.queued === 0).reduce((n, w) => n + w.running, 0);
  let free = Math.max(0, capacity - heldElsewhere);
  const ready = [...by.entries()].filter(([, w]) => w.queued > 0).map(([id, w]) => ({ id, ...w, demand: w.running + w.queued,
    weight: priorities?.[id]?.weight ?? 1, reserve: priorities?.[id]?.reserve ?? 0, target: 0 }));
  const order = (a, b) => b.weight - a.weight || a.id.localeCompare(b.id);
  for (const w of [...ready].sort(order)) {
    const r = Math.min(w.reserve, w.demand, free);
    w.target = r; free -= r;
  }
  while (free > 0) {
    const open = ready.filter((w) => w.target < w.demand);
    if (!open.length) break;
    open.sort((a, b) => a.target / a.weight - b.target / b.weight || order(a, b));
    open[0].target += 1; free -= 1;
  }
  const targets = {};
  for (const w of ready) targets[w.id] = { target: w.target, weight: w.weight, reserve: w.reserve, running: w.running, queued: w.queued, demand: w.demand };
  return { capacity, free, targets };
}

/**
 * The priority workflows starving now. Pure. Demand is running + queued-READY (starci kernel status progress.queuedReady: the
 * queued jobs whose queuedBecause is 'ready'); a job waiting on a live file lease, a dependency, a decision or any
 * other wait is not demand the slots could serve. `ready`: {<workflowId>: queuedReady}; a workflow with no reading
 * counts no ready work (never starved on a guess). Starved: reserve > 0, queuedReady > 0, running <
 * min(reserve, running + queuedReady).
 */
export function starvedWorkflows({ ops = [], priorities = {}, ready = {} }) {
  const out = [];
  for (const [id, p] of Object.entries(priorities ?? {}).filter(([, q]) => q?.reserve > 0)) {
    const mine = ops.filter((o) => o.workflowId === id);
    const running = mine.filter((o) => o.status !== 'queued').length;
    const queued = mine.length - running;
    const queuedReady = Math.max(0, Math.floor(Number(ready?.[id]) || 0));
    const want = Math.min(p.reserve, running + queuedReady);
    if (queuedReady > 0 && running < want) out.push({ workflowId: id, running, queued, queuedReady, want, reserve: p.reserve, weight: p.weight });
  }
  return out;
}

/**
 * quota-exhausted over one ledger. Pure. `jobs`: [{op, status, pool}] (queued and slot-holding ops); `openProviders`:
 * the providers whose circuit is open; `providerOf(pool)`. An op kind is exhausted when it has queued work, none of
 * it runs, and every pool its queued jobs name maps to an open provider (a kind whose queued jobs name no pool yet
 * is never judged: the router picks at dispatch). [{op, queued, pools, providers}].
 */
export function quotaExhausted({ jobs = [], openProviders = [], providerOf = () => null }) {
  const open = new Set(openProviders);
  const kinds = new Map();
  for (const j of jobs) { const k = kinds.get(j.op) ?? []; k.push(j); kinds.set(j.op, k); }
  const out = [];
  for (const [op, list] of kinds) {
    const queued = list.filter((j) => j.status === 'queued');
    if (!queued.length || list.some((j) => j.status !== 'queued')) continue;
    if (queued.some((j) => !j.pool)) continue;
    const pools = [...new Set(queued.map((j) => j.pool))];
    const providers = pools.map((p) => providerOf(p));
    if (providers.some((p) => !p || !open.has(p))) continue;
    out.push({ op, queued: queued.length, pools, providers: [...new Set(providers)] });
  }
  return out;
}
