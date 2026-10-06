// Planned op chain (goals.json opChain) joined with the units and attempts that exist, so the
// UI can draw the whole pipeline in order — including legs that have no unit yet.
import { opInfo } from './op-catalog.mjs';
import { kernelNotesFor, whyFor } from './why.mjs';
import { one, many, parse } from './query.mjs';
import { attemptRow } from './attempt-read.mjs';
import { latestVersion, liveColors } from '../../scripts/work/work-graph-store.mjs';
import { planGraphOf } from '../../scripts/route/plan-edges.mjs';

/** Semantic status shared by every UI surface (see ui/src/components/status.ts). */
export const STATUSES = ['success', 'running', 'settling', 'queued', 'retry', 'failed', 'blocked', 'awaiting-owner', 'planned', 'deferred', 'external', 'dropped', 'rejected', 'unknown'];

/** An attempt is open while it has been dispatched and nothing ended it: no settle (settled_at) and no end state (a refused launch, a dead worker, a cancel). */
export const attemptOpen = (row) => row.dispatched_at != null && row.settled_at == null && row.end_state == null;

/** How an ended attempt without a verdict reads: a requeued launch is not a try (rejected), an unknown effect waits on reconcile. */
const END_STATE_STATUS = { requeued: 'rejected', 'worker-dead': 'failed', 'effect-unknown': 'blocked', cancelled: 'dropped' };

function attemptStatus(row) {
  // v_op_history.ui (docs/why.md): an op that ended with an ask waits on the owner; a launch refused at submission is not a try.
  if (row.ui === 'awaiting-owner') return 'awaiting-owner';
  if (row.ui === 'rejected') return 'rejected';
  if (row.verdict === 'pass') return 'success';
  if (row.verdict === 'blocked') return 'blocked';
  if (row.verdict === 'fail' || row.verdict === 'partial') return 'failed';
  if (row.verdict === 'dropped' || row.verdict === 'cancelled') return 'dropped';
  if (END_STATE_STATUS[row.end_state]) return END_STATE_STATUS[row.end_state];
  if (attemptOpen(row)) return row.reported_at != null || row.report_outcome ? 'settling' : 'running';
  return 'unknown';
}

function levelsOf(ops, edges) {
  const level = Object.fromEntries(ops.map(op => [op, 0]));
  for (let pass = 0; pass < ops.length; pass++) {
    let changed = false;
    for (const [from, to] of edges) if (level[from] != null && level[to] != null && level[to] < level[from] + 1) { level[to] = level[from] + 1; changed = true; }
    if (!changed) break;
  }
  return level;
}

function graphAnomalies(ops, edges, recordedEdges) {
  const out = [];
  if (ops.length > 1 && !Array.isArray(recordedEdges)) out.push({ kind: 'missing-edges', from: null, to: null });
  for (const edge of Array.isArray(recordedEdges) ? recordedEdges : []) {
    if (!Array.isArray(edge) || edge.length !== 2) out.push({ kind: 'malformed-edge', from: null, to: null });
    else if (!ops.includes(edge[0]) || !ops.includes(edge[1])) out.push({ kind: 'dangling-edge', from: String(edge[0]), to: String(edge[1]) });
    else if (edge[0] === edge[1]) out.push({ kind: 'self-edge', from: edge[0], to: edge[1] });
  }
  const pending = new Set(ops), ready = ops.filter(op => !edges.some(([, to]) => to === op));
  while (ready.length) {
    const op = ready.shift(); pending.delete(op);
    for (const [from, to] of edges) if (from === op && pending.has(to) && !edges.some(([parent, child]) => child === to && pending.has(parent))) ready.push(to);
  }
  for (const op of pending) out.push({ kind: 'cycle-or-dependent', from: op, to: null });
  return out;
}

function legStatus(leg, units, attempts) {
  if (leg.deferred) return 'deferred';
  if (!units.length) return leg.external ? 'external' : 'planned';
  if (units.every(u => u.state === 'done')) return 'success';
  if (units.every(u => u.state === 'dropped')) return 'dropped';
  const open = attempts.filter(attemptOpen);
  if (open.some(a => !(a.reported_at != null || a.report_outcome))) return 'running';
  if (open.length) return 'settling';
  // A unit whose latest try asked the owner waits for the answer; it did not fail.
  const latest = attempts[attempts.length - 1];
  if (latest && latest.ui === 'awaiting-owner') return 'awaiting-owner';
  if (units.some(u => u.state === 'failed')) return 'failed';
  if (units.some(u => ['running', 'reported', 'deciding'].includes(u.state))) return 'running';
  if (attempts.some(a => a.verdict && a.verdict !== 'pass')) return 'retry';
  return 'queued';
}

function attemptBrief(a, project, db) {
  const row = attemptRow(a, project, db);
  return { ...row, why: whyFor(db, a), usageSource: a.usage_source ?? null, try: row.attempt,
    status: attemptStatus(a), open: attemptOpen(a), endedAt: row.terminalEndedAt };
}

/** Builds the pipeline view for one workflow. */
export function pipelineOf(db, project, wf) {
  const goal = one(db, 'SELECT revision,json,approved_by,approval_ref FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1', wf);
  const goalJson = parse(goal?.json);
  const chain = goalJson?.opChain ?? null;
  const recordedLegs = (Array.isArray(chain?.legs) ? chain.legs : []).filter(leg => leg && typeof leg.op === 'string')
    .map(leg => ({ ...leg, inPlan: true, runtimeAggregate: false, op: leg.instance && !leg.op.includes('#') ? `${leg.op}#${leg.instance}` : leg.op }));
  const rawLegs = [...new Map(recordedLegs.map(leg => [leg.op, leg])).values()];
  const units = many(db, 'SELECT unit_id,op_id,goal_revision,subject_key,current_job_id,title,state,tries,dispatches,try_budget,updated_at,done_at FROM work_units WHERE workflow_id=? ORDER BY created_at,unit_id', wf);
  const attempts = many(db, 'SELECT * FROM v_op_history WHERE workflow_id=? ORDER BY attempt_id', wf);
  // Runtime records are keyed by base operation, not planner instance. Do not duplicate their
  // attempts onto several op#instance legs or infer which instance owns a base-op record.
  const ops = rawLegs.map(leg => leg.op);
  for (const op of new Set([...units.map(unit => unit.op_id), ...attempts.map(attempt => attempt.op_id)])) {
    if (!ops.includes(op)) {
      const aggregate = ops.some(label => label.split('#')[0] === op);
      ops.push(op);
      rawLegs.push({ seq: rawLegs.length + 1, op, inPlan: false, runtimeAggregate: true,
        injected: aggregate ? 'Recorded at operation scope; planner instance association is unproven' : 'Recorded operation outside the stored chain' });
    }
  }
  const plannedOps = rawLegs.filter(leg => leg.inPlan).map(leg => leg.op);
  const edges = (Array.isArray(chain?.edges) ? chain.edges : []).filter(e => Array.isArray(e) && e.length === 2 && plannedOps.includes(e[0]) && plannedOps.includes(e[1]));
  const anomalies = graphAnomalies(plannedOps, edges, chain?.edges);
  if (recordedLegs.length !== plannedOps.length) anomalies.push({ kind: 'duplicate-leg', from: null, to: null });
  let scheduling = null;
  try { const graph = planGraphOf(goalJson); scheduling = { ...graph, edges: graph.edges.map(([from, to]) => ({ from, to })), readError: null }; }
  catch (error) { scheduling = { source: 'derivedPlan', ops: [], edges: [], readError: String(error?.message ?? error) }; }
  const level = levelsOf(ops, edges);
  const legs = rawLegs.map(leg => {
    const legUnits = units.filter(u => u.op_id === leg.op && (!leg.inPlan || u.goal_revision === goal?.revision));
    const boundUnits = new Set(legUnits.map(u => u.unit_id));
    const legAttempts = attempts.filter(a => a.op_id === leg.op && (!leg.inPlan || boundUnits.has(a.unit_id)));
    const status = legStatus(leg, legUnits, legAttempts);
    return {
      seq: leg.seq, op: leg.op, status, level: level[leg.op] ?? 0,
      inPlan: leg.inPlan, runtimeAggregate: leg.runtimeAggregate,
      binding: !leg.inPlan ? 'operation-history' : legUnits.length ? 'recorded-unit' : 'unbound',
      goalRevision: leg.inPlan ? goal?.revision ?? null : null,
      external: Boolean(leg.external), deferred: leg.deferred ?? null, injected: leg.injected ?? null,
      needs: leg.needsSatisfiedBy ?? [], produces: leg.producesCovered ?? [], conditions: leg.conditions ?? [],
      manifest: leg.yaml ? String(leg.yaml).replaceAll('\\', '/') : null,
      units: legUnits.map(u => ({ unit: u.unit_id, title: u.title ?? u.unit_id, state: u.state, tries: u.tries, dispatches: u.dispatches,
        tryBudget: u.try_budget, goalRevision: u.goal_revision, subjectKey: u.subject_key, currentJob: u.current_job_id,
        updatedAt: u.updated_at, doneAt: u.done_at,
        href: `#/w/${encodeURIComponent(project)}/${encodeURIComponent(wf)}?tab=units&unit=${encodeURIComponent(u.unit_id)}` })),
      attempts: legAttempts.map(a => attemptBrief(a, project, db)),
      why: (() => { const latest = legAttempts.filter(a => a.dispatched_at != null).at(-1); return latest && status !== 'success' ? whyFor(db, latest) : null; })(),
      current: ['running', 'settling', 'retry'].includes(status),
      info: opInfo(leg.op.split('#')[0], leg.yaml ? String(leg.yaml).split(String.fromCodePoint(92)).join('/') : null),
    };
  });
  const planLegs = legs.filter(leg => leg.inPlan);
  const countable = planLegs.filter(leg => !['deferred', 'external', 'dropped'].includes(leg.status));
  const graph = latestVersion(db, wf);
  const g = graph?.graph;
  const colors = graph ? liveColors(db, graph) : {};
  const lastEvent = one(db, 'SELECT max(at) AS at FROM (SELECT max(at) AS at FROM logs WHERE workflow_id=? UNION ALL SELECT max(occurred_at) FROM events WHERE workflow_id=?)', wf, wf)?.at ?? null;
  return {
    goalRevision: goal?.revision ?? null, chainStatus: chain?.status ?? (chain ? 'ok' : 'missing'),
    approvedBy: goal?.approved_by ?? null, approvalRef: goal?.approval_ref ?? null,
    approvalState: goal?.approved_by && goal?.approval_ref ? 'recorded' : 'unproven',
    planSource: 'goals.opChain', scheduling, anomalies,
    legs, edges: edges.map(([from, to]) => ({ from, to })),
    progress: { scope: 'goal-revision', available: Boolean(chain) && anomalies.length === 0, done: countable.filter(l => l.status === 'success').length, total: countable.length,
      byStatus: Object.fromEntries(STATUSES.map(s => [s, planLegs.filter(l => l.status === s).length]).filter(([, n]) => n)) },
    current: legs.filter(l => l.current).map(l => l.op),
    waiting: legs.filter(l => l.status === 'queued').map(l => l.op),
    kernelNotes: kernelNotesFor(db, wf),
    failures: attempts.filter(a => a.settled_at != null && ['fail', 'partial'].includes(a.verdict) && a.ui !== 'awaiting-owner' && a.end_state !== 'cancelled').length,
    attempts: attempts.length, lastEventAt: lastEvent,
    workGraph: g ? { version: graph.version, digest: graph.digest, event: graph.event, reason: graph.reason, authorOp: graph.authorOp, authorJob: graph.authorJob, at: graph.createdAt,
      domains: g.domains ?? [], nodes: (g.nodes ?? []).map(n => ({ id: n.id, title: n.title ?? n.id, domain: n.domain ?? null, kind: n.kind ?? null,
        parent: n.parent ?? null, slice: n.slice ?? null, ownedPaths: Array.isArray(n.ownedPaths) ? n.ownedPaths : null, color: colors[n.id] ?? null,
        ...Object.fromEntries(['reads', 'rollbackTo', 'size', 'frs', 'shapes', 'inferred'].filter(key => Object.hasOwn(n, key)).map(key => [key, n[key]])) })),
      colorSource: 'runtime-live',
      edges: (g.edges ?? []).map(e => ({ from: e.from, to: e.to, kind: e.kind ?? null, reason: e.reason ?? null, ...(Object.hasOwn(e, 'inferred') ? { inferred: e.inferred } : {}) })) } : null,
  };
}
