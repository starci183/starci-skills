// unit-graph.mjs (ui) — two read models of the workflow page's unit board (GET /api/workflow `board`), both pure over
// ledger rows the caller already read (ui/reconciler.mjs unitBoard) and both limited to what the ledger RECORDS:
//
//   unitGraphOf   the work dependency DAG between units (scripts/kernel/progress-rca.mjs unitsOf keys). An edge is a
//                 gate the dispatch admission actually applies (scripts/kernel/api.mjs queuedBecauseInner):
//                   after  a job's declared `payload.after` (api enqueue --after, api graph-edit, settle canon-wire
//                          widening); the prerequisite job's unit -> the dependent job's unit;
//                   seam   a cut ordinal > 1 waits on its cut's seam, ordinal 1 of the same op and cut id
//                          (scripts/kernel/cut-seam.mjs, api.mjs cutSeamHeadOf); `released` names the recorded
//                          contract-first release (`payload.cut.seamStub.mode`) when the sibling ran on a stub.
//                 Never inferred: not from ordinal order beyond the seam rule, not from the op plan (plan.edges is
//                 the op-level leg order), not from time. Work-record `dependsOn` holds (api status
//                 recordDependencies) are read from Work YAML at status time and are not in the ledger, so they are
//                 named in `omitted`, not drawn. The Kernel/Op actor graph is a different graph and is not here.
//   attemptOf     the provider/model an attempt actually ran on and when: the job's `payload.hierarchy.runtime`
//                 (route fills agent/provider/model/pool; dispatch adds dispatchId/terminal) plus its ledger events.
//                 A field with no recorded source is null and `why` says which.
//
// Provider/model are properties of the attempt, never a node of the graph (owner 2026-09-28 business model).

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);
const str = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const num = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null);
const clip = (value, n = 160) => { const s = String(value ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

export const UNIT_EDGE_KINDS = Object.freeze(['after', 'seam']);
/** Each edge kind's ledger field (an edge's `source`) and what writes it (the graph's `sources`). */
export const UNIT_EDGE_SOURCE = Object.freeze({ after: 'jobs.payload.after', seam: 'jobs.payload.cut' });
export const UNIT_GRAPH_SOURCES = Object.freeze({
  after: 'jobs.payload.after: api enqueue --after, api graph-edit, settle canon-wire widening',
  seam: 'jobs.payload.cut: an ordinal > 1 waits on ordinal 1 of the same op and cut id (cut-seam.mjs); cut.seamStub records a release',
});

/**
 * The unit dependency graph of one workflow. `jobs` are its op jobs with parsed payloads (progress-rca opJobsOf),
 * `units` their unitsOf() units. Pure. Returns
 *   {status: ok | empty, reason, nodes: [{unitKey, jobId, op, status, unitState, attempts, cut}], edges: [{from, to,
 *   kind, source, fromJob, toJob, met, released}], counts: {after, seam, dangling, selfLoops}, sources, omitted: [{kind, why}]}.
 * `from` is the prerequisite unit, `to` the unit that waits; `met` is true once the prerequisite unit has a job that
 * settled succeeded. One edge per (from, to, kind): a retry copies its predecessor's `after`, so the newest job's
 * declaration is the one shown.
 */
export function unitGraphOf(jobs, units, { cap = 400 } = {}) {
  const unitOfJob = new Map(units.flatMap((u) => u.jobs.map((j) => [j.job_id, u])));
  const byKey = new Map(units.map((u) => [u.key, u]));
  const edges = new Map();
  const counts = { after: 0, seam: 0, dangling: 0, selfLoops: 0 };
  const add = (from, to, kind, fromJob, toJob, released = null) => {
    if (from.key === to.key) { counts.selfLoops++; return; }
    const id = `${from.key}\u0000${to.key}\u0000${kind}`;
    const prior = edges.get(id);
    const createdAt = Number(unitOfJob.get(toJob)?.jobs.find((j) => j.job_id === toJob)?.created_at) || 0;
    if (prior && prior.createdAt >= createdAt) return;
    edges.set(id, { from: from.key, to: to.key, kind, source: UNIT_EDGE_SOURCE[kind], fromJob, toJob, met: from.state === 'done', released, createdAt });
  };
  for (const job of jobs) {
    const to = unitOfJob.get(job.job_id);
    if (!to) continue;
    for (const priorId of Array.isArray(job.payload?.after) ? job.payload.after : []) {
      const from = unitOfJob.get(String(priorId));
      if (!from) { counts.dangling++; continue; }
      add(from, to, 'after', String(priorId), job.job_id);
    }
    const cut = job.payload?.cut;
    if (cut?.id != null && Number(cut.ordinal) > 1) {
      const seam = byKey.get(`${job.op_id}|${cut.id}#1`);
      if (seam) add(seam, to, 'seam', seam.last.job_id, job.job_id, str(cut.seamStub?.mode));
    }
  }
  const list = [...edges.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind))
    .map(({ createdAt, ...edge }) => edge); // eslint-disable-line no-unused-vars
  for (const edge of list) counts[edge.kind]++;
  const nodes = units.slice(0, cap).map((u) => ({
    unitKey: u.key, jobId: u.last.job_id, op: u.op, status: u.last.status, unitState: u.state, attempts: u.jobs.length,
    cut: u.cut?.id != null && Number.isInteger(Number(u.cut.ordinal)) ? { id: String(u.cut.id), ordinal: Number(u.cut.ordinal), total: Number.isInteger(Number(u.cut.total)) ? Number(u.cut.total) : null } : null,
  }));
  const kept = new Set(nodes.map((n) => n.unitKey));
  const omitted = [{ kind: 'record', why: 'Work-record dependsOn holds (api status recordDependencies) are read from Work YAML at status time, not recorded in the ledger; not drawn' }];
  if (units.length > cap) omitted.push({ kind: 'nodes', why: `${units.length - cap} units past the cap of ${cap} (and their edges) are not listed` });
  const shown = list.filter((e) => kept.has(e.from) && kept.has(e.to));
  const reason = !units.length ? 'the workflow has no op job yet'
    : !shown.length ? 'no job of this workflow records a dependency: no payload.after, and no cut has a sibling behind its seam' : null;
  return { status: shown.length ? 'ok' : 'empty', reason, nodes, edges: shown, counts, sources: { ...UNIT_GRAPH_SOURCES }, omitted };
}

/**
 * The provider/model and timing of ONE attempt (a job row). `events` are that job's ledger events as
 * {kind, created_at, payload}; `report` its filed report ({at}) or null. Pure.
 *   stage     dispatched (an op-dispatched event or a runtime dispatchId), routed (route chose a pool, the attempt
 *             never started), or none (never routed);
 *   agent, provider, model (the model id), pool (the runtime pool/profile), effort: jobs.payload.hierarchy.runtime,
 *             else the newest op-dispatched event's model/modelId; null when no source records it;
 *   routedAt  payload.routedAt; startedAt the first op-dispatched event; dispatches how many;
 *   lastEventAt the newest ledger event about the job; reportedAt the report's filing; settledAt the op-settled
 *             event (the Kernel verdict, kept apart from the Op's report outcome by the board unit).
 */
export function attemptOf(job, events = [], report = null) {
  const payload = job.payload ?? {};
  const rt = payload.hierarchy?.runtime ?? {};
  const dispatched = events.filter((e) => e.kind === 'op-dispatched').sort((a, b) => a.created_at - b.created_at);
  const lastDispatch = dispatched[dispatched.length - 1]?.payload ?? null;
  const settled = events.filter((e) => e.kind === 'op-settled').sort((a, b) => b.created_at - a.created_at)[0] ?? null;
  const stage = dispatched.length || str(rt.dispatchId) ? 'dispatched' : str(rt.provider) || str(payload.model) ? 'routed' : 'none';
  const pick = (primary, fallback) => str(primary) ?? str(fallback);
  const out = {
    number: Number.isInteger(job.attempt) ? job.attempt : null, stage,
    agent: pick(rt.agent, payload.agent), provider: pick(rt.provider, payload.provider),
    model: pick(rt.model, lastDispatch?.modelId ?? payload.modelId), pool: pick(rt.runtimePool ?? rt.profile, lastDispatch?.model ?? payload.model),
    effort: pick(lastDispatch?.effort, payload.effort),
    routedAt: num(payload.routedAt), startedAt: num(dispatched[0]?.created_at), dispatches: dispatched.length,
    lastEventAt: events.length ? Math.max(...events.map((e) => Number(e.created_at) || 0)) || null : null,
    reportedAt: num(report?.at), settledAt: num(settled?.created_at) ?? num(payload.settledAt),
  };
  out.source = stage === 'none' ? null
    : `jobs.payload.hierarchy.runtime${stage === 'dispatched' ? ` + ${dispatched.length} op-dispatched event(s)` : ' (routed; never dispatched)'}`;
  const missing = [];
  if (stage === 'none') missing.push('never routed: no provider/model chosen');
  else {
    for (const f of ['agent', 'provider', 'model', 'pool']) if (!out[f]) missing.push(`${f}: not recorded on the job`);
    if (stage === 'routed') missing.push(TERMINAL.has(job.status) ? 'startedAt: the attempt ended before any dispatch' : 'startedAt: not dispatched yet');
  }
  if (!out.effort && stage !== 'none') missing.push('effort: none recorded by route or dispatch');
  if (!out.routedAt && stage !== 'none') missing.push('routedAt: not recorded on the job (older route)');
  out.why = missing.length ? clip(missing.join('; '), 400) : null;
  return out;
}

/** The stored settled diff of a unit (job_artifacts kind patch, newest job first) as a pointer for GET /api/diff. */
export function diffRefOf(unit, patches) {
  for (const job of [...unit.jobs].reverse()) {
    const row = patches.get(job.job_id);
    if (row) return { jobId: job.job_id, label: row.label === 'landed' || row.label === 'unlanded' ? row.label : null, headSha: str(row.head_sha), landedSha: str(row.landed_sha), at: num(row.created_at) };
  }
  return null;
}
