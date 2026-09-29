// Planned op chain (goals.json opChain) joined with the units and attempts that exist, so the
// UI can draw the whole pipeline in order — including legs that have no unit yet.
import { opInfo } from './op-catalog.mjs';
import { kernelNotesFor, whyFor } from './why.mjs';
const one = (db, sql, ...args) => db.prepare(sql).get(...args) ?? null;
const many = (db, sql, ...args) => db.prepare(sql).all(...args);
const parse = (value, fallback = null) => { try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; } };

/** Semantic status shared by every UI surface (see ui/src/components/status.ts). */
export const STATUSES = ['success', 'running', 'settling', 'queued', 'retry', 'failed', 'blocked', 'awaiting-owner', 'planned', 'deferred', 'external', 'dropped', 'rejected', 'unknown'];

/** An attempt is open while it has been dispatched and nothing ended it: no settle (settled_at) and no end state (a refused launch, a dead worker, a cancel). */
export const attemptOpen = (row) => row.dispatched_at != null && row.settled_at == null && row.end_state == null;

/** How an ended attempt without a verdict reads: a requeued launch is not a try (rejected), an unknown effect waits on reconcile. */
const END_STATE_STATUS = { requeued: 'rejected', 'worker-dead': 'failed', 'effect-unknown': 'blocked', cancelled: 'dropped' };

export function attemptStatus(row) {
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

export function attemptBrief(a, project, db = null) {
  return { id: a.attempt_id, why: db ? whyFor(db, a) : null, usageSource: a.usage_source ?? null, unit: a.unit_id, job: a.job_id, try: a.try_no, status: attemptStatus(a),
    open: attemptOpen(a), endState: a.end_state ?? null, reportOutcome: a.report_outcome, verdict: a.verdict, model: a.model, agent: a.agent, pool: a.pool,
    dispatchedAt: a.dispatched_at, reportedAt: a.reported_at, settledAt: a.settled_at,
    checks: a.checks ?? 0, checksRed: a.checks_red ?? 0, tokensIn: a.tokens_in ?? null, tokensOut: a.tokens_out ?? null, costUsd: a.cost_usd ?? null,
    summary: a.report_summary ?? null, href: `#/a/${encodeURIComponent(project)}/${a.attempt_id}` };
}

/** Builds the pipeline view for one workflow. */
export function pipelineOf(db, project, wf) {
  const goal = one(db, 'SELECT revision,json FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1', wf);
  const chain = parse(goal?.json)?.opChain ?? null;
  const rawLegs = Array.isArray(chain?.legs) ? chain.legs : [];
  const units = many(db, 'SELECT unit_id,op_id,title,state,tries,dispatches,try_budget,updated_at,done_at FROM work_units WHERE workflow_id=? ORDER BY created_at,unit_id', wf);
  const attempts = many(db, 'SELECT * FROM v_op_history WHERE workflow_id=? ORDER BY attempt_id', wf);
  // Units whose op is not in the approved chain (kernel-added legs) still appear, after their op's first use.
  const ops = rawLegs.map(leg => leg.op);
  for (const unit of units) if (!ops.includes(unit.op_id)) { ops.push(unit.op_id); rawLegs.push({ seq: rawLegs.length + 1, op: unit.op_id, injected: 'added by the kernel after approval' }); }
  const edges = (Array.isArray(chain?.edges) ? chain.edges : []).filter(e => Array.isArray(e) && ops.includes(e[0]) && ops.includes(e[1]));
  const level = levelsOf(ops, edges);
  const legs = rawLegs.map(leg => {
    const legUnits = units.filter(u => u.op_id === leg.op);
    const legAttempts = attempts.filter(a => a.op_id === leg.op);
    const status = legStatus(leg, legUnits, legAttempts);
    return {
      seq: leg.seq, op: leg.op, status, level: level[leg.op] ?? 0,
      external: Boolean(leg.external), deferred: leg.deferred ?? null, injected: leg.injected ?? null,
      needs: leg.needsSatisfiedBy ?? [], produces: leg.producesCovered ?? [], conditions: leg.conditions ?? [],
      manifest: leg.yaml ? String(leg.yaml).replaceAll('\\', '/') : null,
      units: legUnits.map(u => ({ unit: u.unit_id, title: u.title ?? u.unit_id, state: u.state, tries: u.tries, dispatches: u.dispatches,
        tryBudget: u.try_budget, updatedAt: u.updated_at, doneAt: u.done_at,
        href: `#/w/${encodeURIComponent(project)}/${encodeURIComponent(wf)}?tab=units&unit=${encodeURIComponent(u.unit_id)}` })),
      attempts: legAttempts.map(a => attemptBrief(a, project, db)),
      why: (() => { const latest = legAttempts.filter(a => a.dispatched_at != null).at(-1); return latest && status !== 'success' ? whyFor(db, latest) : null; })(),
      current: ['running', 'settling', 'retry'].includes(status),
      info: opInfo(leg.op, leg.yaml ? String(leg.yaml).split(String.fromCharCode(92)).join('/') : null),
    };
  });
  const countable = legs.filter(l => !['deferred', 'external', 'dropped'].includes(l.status));
  const graph = one(db, 'SELECT version,event,graph_json,colors_json,reason,author_op,created_at FROM work_graph_versions WHERE workflow_id=? ORDER BY version DESC LIMIT 1', wf);
  const g = parse(graph?.graph_json);
  const lastEvent = one(db, 'SELECT max(at) AS at FROM (SELECT max(at) AS at FROM logs WHERE workflow_id=? UNION ALL SELECT max(occurred_at) FROM events WHERE workflow_id=?)', wf, wf)?.at ?? null;
  return {
    goalRevision: goal?.revision ?? null, chainStatus: chain?.status ?? (chain ? 'ok' : 'missing'),
    legs, edges: edges.map(([from, to]) => ({ from, to })),
    progress: { done: countable.filter(l => l.status === 'success').length, total: countable.length,
      byStatus: Object.fromEntries(STATUSES.map(s => [s, legs.filter(l => l.status === s).length]).filter(([, n]) => n)) },
    current: legs.filter(l => l.current).map(l => l.op),
    waiting: legs.filter(l => l.status === 'queued').map(l => l.op),
    kernelNotes: kernelNotesFor(db, wf),
    failures: attempts.filter(a => a.verdict && a.verdict !== 'pass').length,
    attempts: attempts.length, lastEventAt: lastEvent,
    workGraph: g ? { version: graph.version, event: graph.event, reason: graph.reason, authorOp: graph.author_op, at: graph.created_at,
      domains: g.domains ?? [], nodes: (g.nodes ?? []).map(n => ({ id: n.id, title: n.title ?? n.id, domain: n.domain ?? null, kind: n.kind ?? null,
        ownedPaths: n.ownedPaths ?? [], color: parse(graph.colors_json, {})?.[n.id] ?? null })),
      edges: (g.edges ?? []).map(e => ({ from: e.from, to: e.to, kind: e.kind ?? null, reason: e.reason ?? null })) } : null,
  };
}

/** Token / cost usage for a workflow or attempt from llm_usage (empty until the runtime records it). */
export function usageOf(db, { wf = null, attempt = null } = {}) {
  const where = attempt != null ? 'attempt_id=?' : 'workflow_id=?';
  const arg = attempt != null ? attempt : wf;
  const rows = many(db, `SELECT coalesce(response_model,request_model,provider) AS model,subject_type,
    sum(input_tokens) AS input,sum(output_tokens) AS output,sum(cache_read_tokens) AS cacheRead,sum(cache_write_tokens) AS cacheWrite,
    sum(reasoning_tokens) AS reasoning,sum(cost_usd) AS costUsd,sum(turns) AS turns,sum(tool_calls) AS toolCalls,sum(tool_errors) AS toolErrors,count(*) AS n
    FROM llm_usage WHERE ${where} GROUP BY 1,2`, arg);
  const total = key => rows.reduce((sum, r) => sum + (r[key] ?? 0), 0);
  return { recorded: rows.length > 0, byModel: rows,
    total: rows.length ? { input: total('input'), output: total('output'), cacheRead: total('cacheRead'), cacheWrite: total('cacheWrite'),
      reasoning: total('reasoning'), costUsd: rows.some(r => r.costUsd != null) ? total('costUsd') : null, turns: total('turns'), toolCalls: total('toolCalls') } : null };
}
