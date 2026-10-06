import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifactRoot } from '../../../engine/db/blob.mjs';
import { attemptOpen, pipelineOf } from '../pipeline.mjs';
import { workflowStateOf } from '../../../scripts/kernel/progress-state.mjs';
import { sendJson, sendError } from '../envelope.mjs';
import { source, many, one, parse, staleOf, page } from '../query.mjs';
import { uiState } from '../state.mjs';
import { reason } from '../reason.mjs';
import { attemptRow } from '../attempt-read.mjs';
import { readMetricSnapshot, metricPayload } from '../metric-read.mjs';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const OPEN_DI = "('open','claimed','escalated')";
const pageData = (rows, url, options) => page(rows, url, 'data', options);
const ref = (kind, id, project = null, wf = null) => ({ kind, ...(project ? { project } : {}), id: String(id), href: hrefOf(kind, id, project, wf) });
function hrefOf(kind, id, project, wf = null) {
  const p = encodeURIComponent(project ?? '');
  const key = encodeURIComponent(String(id));
  if (kind === 'workflow') return `#/w/${p}/${key}`;
  if (kind === 'unit') return project && wf ? `#/w/${p}/${encodeURIComponent(wf)}?tab=units&unit=${key}` : '#/';
  if (kind === 'attempt') return `#/a/${p}/${key}`;
  if (kind === 'di') return `#/decisions?id=${key}`;
  if (kind === 'violation') return `#/system/sla?id=${key}`;
  if (kind === 'land') return `#/system/land?id=${key}`;
  return '#/';
}
// Owner ruling 2026-09-29: host paths are public so each record links to its place on the host.
const hostPath = value => value ? path.normalize(String(value)) : null;
const RUNTIME_ROOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '');
function ledgerRows(store, fn) {
  return store.forEachLedger(({ row, db }) => fn(row, db)).flatMap(entry => entry.error ? [] : entry.result ?? []);
}
function ledgerCoverage(store, reads) {
  const registered = store.projects().length;
  const readable = reads.filter(read => !read.error && read.result != null).length;
  return { registered, readable, complete: readable === registered,
    unavailable: reads.filter(read => read.error).map(read => read.ledger?.ledgerId ?? read.ledger?.name ?? 'unknown') };
}
const observedCoverage = coverage => coverage.registered === 0 || coverage.readable > 0;
function seatOf(machine, project, wf) {
  return one(machine, 'SELECT state,last_seen_at,kernel_rev,acked_rev FROM v_seats WHERE seat_id=?', `kernel:${project}:${wf}`);
}
function workflowRow(store, row, db, progress, extra = {}) {
  const machine = store.machine.db;
  const wf = progress.workflow_id;
  const p = row.name;
  let progressSnapshot = null, progressReadError = null, latest = {};
  try {
    const recorded = readMetricSnapshot(store.machine, 'progress', row.ledgerId, wf);
    latest = metricPayload(recorded, 'starci/progress@1') ?? {};
    progressSnapshot = recorded?.snapshot ?? null;
  } catch (error) { progressReadError = String(error?.message ?? error); }
  const eta = typeof latest.eta === 'string' ? Date.parse(latest.eta) : Number.NaN;
  const dIs = many(db, `SELECT di_id,kind,decider,status,due_at,opened_at,summary,ui FROM v_decision_rows WHERE workflow_id=? AND status IN ${OPEN_DI}`, wf);
  const violations = many(machine, 'SELECT code,severity,violated_at,ui FROM v_sla_open WHERE ledger_id=? AND workflow_id=?', row.ledgerId, wf);
  const seat = seatOf(machine, p, wf);
  const jobs = one(db, "SELECT sum(status IN ('leased','running','answering','reported','deciding')) AS running, sum(status='ready') AS queued_ready FROM jobs WHERE workflow_id=?", wf);
  const unitStates = Object.fromEntries(['planned', 'queued', 'running', 'reported', 'deciding', 'done', 'failed', 'dropped'].map(state => [state, 0]));
  for (const state of many(db, 'SELECT state,count(*) AS n FROM v_units WHERE workflow_id=? GROUP BY state', wf)) unitStates[state.state] = state.n;
  const running = Number(latest.running ?? jobs?.running ?? progress.units_active ?? 0);
  const current = {
    ...progress, ...latest, running, phaseReason: extra.phase_reason ?? null,
    startedAt: extra.created_at ?? null, lastUnitAt: progress.last_unit_at,
    unitsTotal: progress.units_total, unitsDone: progress.units_done, unitsDropped: progress.units_dropped,
    allowedParallel: latest.allowedParallel ?? progress.allowed_parallel,
    queuedReady: latest.queuedReady ?? jobs?.queued_ready ?? 0,
  };
  const state = workflowStateOf(current, { openDIs: dIs, openViolations: violations, seat,
    phaseUi: uiState(db, 'workflow', progress.phase) });
  const primaryDI = dIs.sort((a, b) => Number(b.ui === 'bad') - Number(a.ui === 'bad') || a.opened_at - b.opened_at)[0];
  let onIt = null;
  if (primaryDI) onIt = { who: primaryDI.decider, ref: ref('di', primaryDI.di_id, p), reason: reason('DECISION_OPEN', { kind: primaryDI.kind ?? 'decision' }) };
  else if (state.ui === 'warn' || state.ui === 'bad') onIt = { who: 'kernel', ref: null, reason: state.reason ?? reason('PROGRESS', {}) };
  const pipe = pipelineOf(db, p, wf);
  return {
    pipeline: { goalRevision: pipe.goalRevision, chainStatus: pipe.chainStatus, approvedBy: pipe.approvedBy, approvalRef: pipe.approvalRef, approvalState: pipe.approvalState,
      legs: pipe.legs.map(l => ({ op: l.op, status: l.status, current: l.current, inPlan: l.inPlan, runtimeAggregate: l.runtimeAggregate, binding: l.binding, goalRevision: l.goalRevision, tries: Math.max(0, ...l.units.map(u => u.tries)),
      tryBudget: l.units.length && l.units.every(u => u.tryBudget === l.units[0].tryBudget) ? l.units[0].tryBudget : null, units: l.units.length, attempts: l.attempts.length })),
      progress: pipe.progress, current: pipe.current, failures: pipe.failures, attempts: pipe.attempts, lastEventAt: pipe.lastEventAt,
      why: (() => { const leg = pipe.legs.find(l => l.why && (l.current || ['failed', 'blocked', 'awaiting-owner', 'retry', 'rejected'].includes(l.status))); return leg ? { op: leg.op, headline: leg.why.headline, owner: leg.why.owner } : null; })() },
    project: p, ledgerId: row.ledgerId, id: wf, name: progress.display_name ?? extra.title ?? wf, phase: progress.phase,
    generation: extra.generation, observedGeneration: extra.observed_generation, goalRevision: pipe.goalRevision,
    ui: state.ui, reason: state.reason,
    units: { done: progress.units_done, total: progress.units_total, active: progress.units_active, failed: progress.units_failed }, unitStates,
    ratePerHour: Number.isFinite(latest.unitsPerHour) ? latest.unitsPerHour : null,
    minRatePerHour: Number.isFinite(latest.minUnitsPerHour) ? latest.minUnitsPerHour : null, etaAt: Number.isFinite(eta) ? eta : null,
    progressSnapshot, progressReadError,
    running, allowedParallel: current.allowedParallel ?? null, lastUnitAt: progress.last_unit_at,
    onIt, seat: seat ? { state: seat.state, lastSeenAt: seat.last_seen_at } : null,
    updatedAt: extra.updated_at ?? progressSnapshot?.at ?? null,
  };
}
function workflowRows(store, { project = null } = {}, observations = null) {
  const reads = store.forEachLedger(({ row, db }) => {
    if (project && project !== row.name && project !== row.ledgerId) return [];
    const rows = many(db, 'SELECT p.*,w.phase_reason,w.created_at,w.updated_at,w.title,w.generation,w.observed_generation FROM v_workflow_progress p JOIN workflows w ON w.workflow_id=p.workflow_id');
    return rows.map(progress => workflowRow(store, row, db, progress, progress));
  });
  observations?.push(...reads);
  return reads.flatMap(entry => entry.error ? [] : entry.result ?? []);
}
function attention(store) {
  const machine = store.machine.db;
  const asOf = Math.floor(Date.now() / 60_000) * 60_000;
  const ledgerNames = new Map(store.projects().map(row => [row.ledgerId, row.name]));
  const items = ledgerRows(store, (row, db) => many(db, `SELECT * FROM v_decision_rows WHERE status IN ${OPEN_DI} AND ui IN ('bad','warn')`).map(di => ({
    ref: ref('di', di.di_id, row.name), ui: di.ui, reason: reason(di.overdue ? 'DECISION_OVERDUE' : 'DECISION_OPEN', { kind: di.kind }),
    age: Math.max(0, asOf - di.opened_at), who: di.decider, since: di.opened_at,
  })));
  for (const di of many(machine, "SELECT * FROM v_open_sup_decisions WHERE ui IN ('bad','warn')")) items.push({
    ref: ref('di', di.di_id), ui: di.ui, reason: reason(di.ui === 'bad' ? 'DECISION_OVERDUE' : 'DECISION_OPEN', { kind: di.kind }),
    age: Math.max(0, asOf - di.opened_at), who: 'supervisor', since: di.opened_at,
  });
  for (const row of many(machine, 'SELECT * FROM invariant_violations WHERE cleared_at IS NULL')) items.push({
    ref: ref('violation', row.violation_id, ledgerNames.get(row.ledger_id)), ui: row.severity === 'critical' ? 'bad' : 'warn',
    reason: reason(row.code, {}), age: Math.max(0, asOf - row.violated_at), who: 'controller', since: row.violated_at,
  });
  items.sort((a, b) => Number(b.ui === 'bad') - Number(a.ui === 'bad') || a.since - b.since);
  return items.slice(0, 10).map(({ since, ...item }) => item);
}
function compactHealth(machine) {
  const engine = one(machine, 'SELECT ui FROM v_engine_health');
  const critical = one(machine, "SELECT count(*) AS n FROM v_sla_open WHERE ui='bad'")?.n ?? 0;
  const warning = one(machine, "SELECT count(*) AS n FROM v_sla_open WHERE ui='warn'")?.n ?? 0;
  let slaUi = 'ok', slaReason = null;
  if (critical) { slaUi = 'bad'; slaReason = reason('SLA_CRITICAL', { count: critical }); }
  else if (warning) { slaUi = 'warn'; slaReason = reason('SLA_WARNING', { count: warning }); }
  const items = [
    { key: 'engine', ui: engine?.ui ?? 'unknown', value: engine?.ui ?? 'unknown', reason: null, href: '#/system/engine' },
    { key: 'sla', ui: slaUi, value: String(critical + warning), reason: slaReason,
      href: '#/system/sla' },
  ];
  return { ui: summaryUi(items), items };
}
function summaryUi(items) {
  if (items.some(item => item.ui === 'bad')) return 'bad';
  if (items.some(item => item.ui === 'warn')) return 'warn';
  if (items.some(item => item.ui === 'unknown')) return 'unknown';
  return 'ok';
}
function workers(store, url) {
  const workflowReads = [];
  const workflows = workflowRows(store, {}, workflowReads).filter(row => url.searchParams.get('phase') === 'all' || !['finished', 'archived'].includes(row.phase));
  const ownerReads = store.forEachLedger(({ db }) => one(db, `SELECT count(*) AS n FROM v_decision_rows WHERE decider='owner' AND status IN ${OPEN_DI}`)?.n ?? 0);
  const coverage = { workflows: ledgerCoverage(store, workflowReads), ownerDecisions: ledgerCoverage(store, ownerReads) };
  const workflowsObserved = observedCoverage(coverage.workflows);
  const attentionRows = attention(store);
  const machine = store.machine.db;
  const violationsOpen = one(machine, 'SELECT count(*) AS n FROM invariant_violations WHERE cleared_at IS NULL')?.n ?? 0;
  const health = compactHealth(machine);
  const summary = workersSummary(store);
  return { attention: attentionRows, workflows, health, summary, coverage, counts: {
    live: workflowsObserved ? workflows.filter(row => row.phase === 'running').length : null,
    bad: workflowsObserved ? workflows.filter(row => row.ui === 'bad').length : null,
    warn: workflowsObserved ? workflows.filter(row => row.ui === 'warn').length : null,
    ownerDecisions: (() => { if (!observedCoverage(coverage.ownerDecisions)) return null; return ownerReads.reduce((n, read) => n + (read.error ? 0 : read.result ?? 0), 0); })(),
    violationsOpen,
  } };
}
const USAGE_FIELDS = { input: 'input_tokens', output: 'output_tokens', cacheRead: 'cache_read_tokens', cacheWrite: 'cache_write_tokens', reasoning: 'reasoning_tokens', costUsd: 'cost_usd', turns: 'turns', toolCalls: 'tool_calls', toolErrors: 'tool_errors' };
const usageSums = p => [...Object.entries(USAGE_FIELDS).flatMap(([key, field]) => [`sum(${p}${field}) AS ${key}`, `count(${p}${field}) AS ${key}Known`]), 'count(*) AS n'].join(',');
const usageOrder = p => `coalesce(sum(${p}input_tokens),0)+coalesce(sum(${p}output_tokens),0) DESC`;
const completenessOf = rows => {
  const total = rows.reduce((n, row) => n + (row.completeness?.rows ?? row.n ?? 0), 0);
  const fields = Object.fromEntries(Object.keys(USAGE_FIELDS).map(key => {
    const known = rows.reduce((n, row) => n + (row.completeness?.fields?.[key]?.known ?? row[`${key}Known`] ?? 0), 0);
    return [key, { known, total, complete: known === total }];
  }));
  return { rows: total, fields, complete: Object.values(fields).every(field => field.complete) };
};
const withCompleteness = row => {
  const result = { ...row, completeness: completenessOf([row]) };
  for (const key of Object.keys(USAGE_FIELDS)) delete result[`${key}Known`];
  return result;
};
const usageTotal = rows => {
  const sum = key => { const known = rows.filter(row => row[key] != null); return known.length ? known.reduce((acc, row) => acc + row[key], 0) : null; };
  return rows.length ? { ...Object.fromEntries(Object.keys(USAGE_FIELDS).map(key => [key, sum(key)])), completeness: completenessOf(rows) } : null;
};
const MODEL_OF = 'coalesce(u.response_model,u.request_model,u.provider)';
/** v3 token usage of one workflow or attempt: per model, per op (leg), per row (attempt) and source labels. Extends the v2 shape. */
export function usageDetail(db, { wf = null, attempt = null } = {}) {
  const where = attempt != null ? 'u.attempt_id=?' : 'u.workflow_id=?';
  const arg = attempt != null ? attempt : wf;
  const byModel = many(db, `SELECT ${MODEL_OF} AS model,u.subject_type,u.provider,${usageSums('u.')} FROM llm_usage u WHERE ${where} GROUP BY 1,2,3 ORDER BY ${usageOrder('u.')}`, arg).map(withCompleteness);
  const byOp = many(db, `SELECT coalesce(a.op_id,'kernel') AS op,${usageSums('u.')} FROM llm_usage u LEFT JOIN op_attempts a ON a.attempt_id=u.attempt_id WHERE ${where} GROUP BY 1 ORDER BY ${usageOrder('u.')}`, arg).map(withCompleteness);
  const rows = attempt != null ? many(db, `SELECT usage_id AS id,subject_type,provider,request_model AS requestModel,response_model AS responseModel,source,at,
    input_tokens AS input,output_tokens AS output,cache_read_tokens AS cacheRead,cache_write_tokens AS cacheWrite,reasoning_tokens AS reasoning,
    cost_usd AS costUsd,turns,tool_calls AS toolCalls,tool_errors AS toolErrors FROM llm_usage u WHERE ${where} ORDER BY at,usage_id`, arg) : [];
  const sources = many(db, `SELECT DISTINCT source FROM llm_usage u WHERE ${where}`, arg).map(r => r.source);
  return { recorded: byModel.length > 0, byModel, byOp, rows, sources, total: usageTotal(byModel) };
}
/** Usage since a timestamp for one ledger: grouped per provider, model, op and Vietnam-time day (worker KPI and analytics). */
export function usageSince(db, since, project = null) {
  const q = (key, join = '') => many(db, `SELECT ${key} AS k,${usageSums('u.')} FROM llm_usage u ${join} WHERE u.at>=? GROUP BY 1`, since).map(withCompleteness);
  return { project,
    byProvider: q('u.provider'), byModel: q(MODEL_OF), byOp: q("coalesce(a.op_id,'kernel')", 'LEFT JOIN op_attempts a ON a.attempt_id=u.attempt_id'),
    byDay: q("strftime('%Y-%m-%d',u.at/1000,'unixepoch','+7 hours')"), sources: many(db, 'SELECT DISTINCT source FROM llm_usage WHERE at>=?', since).map(r => r.source) };
}
/** Merge several ledgers' grouped rows (key `k`) into one list, largest first. */
export function mergeUsage(lists) {
  const map = new Map();
  for (const row of lists.flat()) {
    const cur = map.get(row.k) ?? { k: row.k, ...Object.fromEntries(Object.keys(USAGE_FIELDS).map(key => [key, null])), n: 0, completeness: completenessOf([]) };
    for (const key of Object.keys(USAGE_FIELDS)) if (row[key] != null) cur[key] = (cur[key] ?? 0) + row[key];
    cur.n += row.n ?? 0;
    cur.completeness = completenessOf([cur, row]);
    map.set(row.k, cur);
  }
  return [...map.values()];
}
function workersSummary(store) {
  const now = Date.now(), since = now - DAY;
  const reads = store.forEachLedger(({ row, db }) => ({
    attempts: many(db, 'SELECT h.*,a.terminal_closed_at FROM v_op_history h JOIN op_attempts a USING(attempt_id) WHERE h.dispatched_at>=? OR h.settled_at>=? OR (h.dispatched_at IS NOT NULL AND h.settled_at IS NULL AND h.end_state IS NULL)', since, since).map(a => ({ ...a, project: row.name })),
    queued: one(db, "SELECT count(*) AS n FROM work_units u JOIN workflows w USING(workflow_id) WHERE u.state IN ('planned','queued') AND w.phase='running'")?.n ?? 0,
    usage: usageSince(db, since),
  }));
  const measured = reads.filter(read => !read.error && read.result);
  const coverage = ledgerCoverage(store, reads);
  const observed = observedCoverage(coverage);
  const rows = measured.flatMap(read => read.result.attempts);
  const open = rows.filter(attemptOpen);
  const models = new Map();
  for (const a of open) {
    const key = JSON.stringify([a.agent, a.model, a.pool]);
    const m = models.get(key) ?? { model: a.model, pool: a.pool, agent: a.agent, running: 0, settling: 0 };
    if (a.reported_at != null || a.report_outcome) m.settling++; else if (a.terminal_closed_at == null) m.running++;
    models.set(key, m);
  }
  const unitsQueued = observed ? measured.reduce((n, read) => n + read.result.queued, 0) : null;
  const usage = measured.map(read => read.result.usage);
  const total = mergeUsage(usage.map(u => u.byProvider.map(r => ({ ...r, k: 'all' }))))[0] ?? null;
  return {
    scope: 'host-registered-ledgers', window: { from: since, to: now }, coverage,
    opsRunning: observed ? open.filter(a => a.terminal_closed_at == null && !(a.reported_at != null || a.report_outcome)).length : null,
    opsSettling: observed ? open.filter(a => a.reported_at != null || a.report_outcome).length : null,
    unitsQueued,
    failed24h: observed ? rows.filter(a => a.settled_at != null && a.settled_at >= since && a.settled_at <= now && ['fail', 'partial'].includes(a.verdict) && a.ui !== 'awaiting-owner' && a.end_state !== 'cancelled').length : null,
    passed24h: observed ? rows.filter(a => a.settled_at != null && a.settled_at >= since && a.settled_at <= now && a.verdict === 'pass').length : null,
    models: [...models.values()].sort((a, b) => b.running - a.running),
    usage24h: { recorded: Boolean(total?.n), inputTokens: total?.input ?? null, outputTokens: total?.output ?? null, costUsd: total?.costUsd ?? null,
      cacheRead: total?.cacheRead ?? null, cacheWrite: total?.cacheWrite ?? null, reasoning: total?.reasoning ?? null, turns: total?.turns ?? null, toolCalls: total?.toolCalls ?? null,
      completeness: total?.completeness ?? completenessOf([]),
      byProvider: mergeUsage(usage.map(u => u.byProvider)).sort((a, b) => (b.input ?? 0) + (b.output ?? 0) - (a.input ?? 0) - (a.output ?? 0)).map(({ k, ...r }) => ({ provider: k, ...r })), sources: [...new Set(usage.flatMap(u => u.sources))] },
  };
}
function projects(store) {
  const machine = store.machine.db;
  return store.projects().map(row => {
    const ledger = store.ledger(row.name);
    const phases = ledger ? many(ledger.db, 'SELECT phase,count(*) AS n FROM workflows GROUP BY phase') : [];
    const counts = Object.fromEntries(phases.map(item => [item.phase, item.n]));
    const repos = many(machine, 'SELECT name,role,default_branch FROM repositories WHERE ledger_id=? ORDER BY name', row.ledgerId);
    return { id: row.name, name: row.name, product: row.product, state: row.state,
      repos: repos.map(repo => ({ name: repo.name, role: repo.role, branch: repo.default_branch })),
      workflows: { live: counts.running ?? 0, paused: counts.paused ?? 0, stopped: counts.stopped ?? 0,
        finished: counts.finished ?? 0, archived: counts.archived ?? 0 },
      ledgerOk: Boolean(ledger), schemaVersion: row.schemaVersion };
  });
}
function blockerRef(blocker, project, wf) {
  let kind = 'workflow';
  if (blocker.blocker_type === 'decision') kind = 'di';
  else if (blocker.blocker_type === 'unit') kind = 'unit';
  else if (blocker.blocker_type === 'incident') kind = 'incident';
  return ref(kind, blocker.blocker_id, project, wf);
}
function blockerSort(type) {
  if (type === 'decision') return 0;
  if (type === 'unit') return 4;
  return 3;
}
function decisionSubjectType(type, includeAttempt) {
  if (type === 'unit') return 'unit';
  if (includeAttempt && type === 'attempt') return 'attempt';
  return 'workflow';
}
function worktreeUi(item) {
  if (item.remove_error) return 'bad';
  if (item.removed_at) return 'done';
  return 'running';
}
function blockedBy(store, row, db, wf) {
  const machine = store.machine.db;
  const rows = many(db, 'SELECT * FROM v_blocking WHERE workflow_id=?', wf).map(blocker => ({
    ref: blockerRef(blocker, row.name, wf), ui: blocker.blocker_type === 'decision' ? 'warn' : 'waiting',
    reason: reason(blocker.reason_code, {}, blocker.detail ?? undefined), since: blocker.since, who: blocker.who,
    sort: blockerSort(blocker.blocker_type),
  }));
  const diById = new Map(many(db, `SELECT di_id,ui,overdue FROM v_decision_rows WHERE workflow_id=? AND status IN ${OPEN_DI}`, wf).map(di => [di.di_id, di]));
  for (const item of rows) if (item.ref.kind === 'di') { const di = diById.get(item.ref.id); if (di) { item.ui = di.ui; item.sort = di.overdue || di.ui === 'bad' ? -1 : 0; } }
  for (const sla of many(machine, 'SELECT * FROM v_sla_open WHERE ledger_id=? AND workflow_id=?', row.ledgerId, wf)) rows.push({
    ref: ref('violation', sla.episode_id, row.name), ui: sla.ui, reason: reason(sla.code, {}),
    since: sla.entered_at, who: 'controller', sort: 1,
  });
  for (const unit of many(db, "SELECT unit_id,updated_at FROM work_units WHERE workflow_id=? AND state='failed'", wf)) rows.push({
    ref: ref('unit', unit.unit_id, row.name, wf), ui: 'bad', reason: reason('UNIT_FAILED', {}),
    since: unit.updated_at, who: 'kernel', sort: 2,
  });
  rows.sort((a, b) => a.sort - b.sort || a.since - b.since);
  return rows.map(({ sort, ...item }) => item);
}
function detail(store, row, db, wf) {
  const p = one(db, 'SELECT p.*,w.phase_reason,w.created_at,w.updated_at,w.title,w.generation,w.observed_generation FROM v_workflow_progress p JOIN workflows w ON w.workflow_id=p.workflow_id WHERE p.workflow_id=?', wf);
  if (!p) return null;
  const base = workflowRow(store, row, db, p, p);
  const goal = one(db, 'SELECT markdown,revision,created_at,approved_by,approval_ref FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1', wf);
  const lifecycle = one(db, 'SELECT reason FROM lifecycle_changes WHERE workflow_id=? ORDER BY change_id DESC LIMIT 1', wf);
  const seat = seatOf(store.machine.db, row.name, wf);
  const now = Date.now();
  const counts = {
    decisionsOpen: one(db, `SELECT count(*) AS n FROM v_decision_rows WHERE workflow_id=? AND status IN ${OPEN_DI}`, wf)?.n ?? 0,
    incidentsOpen: one(db, "SELECT count(*) AS n FROM incidents WHERE workflow_id=? AND status='open'", wf)?.n ?? 0,
    violationsOpen: one(store.machine.db, 'SELECT count(*) AS n FROM v_sla_open WHERE ledger_id=? AND workflow_id=? AND violated_at IS NOT NULL', row.ledgerId, wf)?.n ?? 0,
    failed24h: one(db, "SELECT count(*) AS n FROM v_op_history WHERE workflow_id=? AND verdict IN ('fail','partial') AND settled_at>=? AND ui<>'awaiting-owner' AND coalesce(end_state,'')<>'cancelled'", wf, now - DAY)?.n ?? 0,
    attempts24h: one(db, 'SELECT count(*) AS n FROM v_op_history WHERE workflow_id=? AND dispatched_at>=?', wf, now - DAY)?.n ?? 0,
    costUsd24h: one(db, 'SELECT sum(cost_usd) AS cost FROM llm_usage WHERE workflow_id=? AND at>=?', wf, now - DAY)?.cost ?? null,
  };
  return { ...base, goal: goal ? { text: goal.markdown, revision: goal.revision, at: goal.created_at, approvedBy: goal.approved_by ?? null, approvalRef: goal.approval_ref ?? null } : { text: '', revision: 0, at: p.created_at, approvedBy: null, approvalRef: null },
    phaseReason: p.phase_reason ?? lifecycle?.reason ?? null,
    kernelRev: seat ? { current: seat.kernel_rev ?? '', acked: seat.acked_rev ?? null, stale: Boolean(seat.kernel_rev && seat.acked_rev && seat.kernel_rev !== seat.acked_rev) } : null,
    blockedBy: blockedBy(store, row, db, wf), counts,
    where: whereOf(store, row, db, wf), usage: usageDetail(db, { wf }),
  };
}
function whereOf(store, row, db, wf) {
  const machine = store.machine.db;
  const repos = many(machine, 'SELECT name,role,repo_root FROM repositories WHERE ledger_id=? ORDER BY name', row.ledgerId).map(r => ({ name: r.name, role: r.role, root: hostPath(r.repo_root) }));
  const backend = repos.find(r => r.role === 'backend') ?? repos[0] ?? null;
  const roots = backend ? backend.root : row.repoRoot ?? null;
  return { repos, workTree: roots ? path.join(roots, '.starciwork') : null, ledgerFile: row.file ?? null,
    blobRoot: artifactRoot(), runtimeRoot: RUNTIME_ROOT, kernelSeat: `kernel:${row.name}:${wf}`,
    // The workflow's op terminals as its ledger recorded each dispatch (op_attempts); Orca accounts for the workers.
    terminals: many(db, 'SELECT terminal_handle,attempt_id,worker_pid,dispatched_at,terminal_closed_at FROM op_attempts WHERE workflow_id=? AND terminal_handle IS NOT NULL ORDER BY dispatched_at DESC', wf)
      .map(t => ({ handle: t.terminal_handle, role: 'op', attempt: t.attempt_id, pid: t.worker_pid, openedAt: t.dispatched_at, closedAt: t.terminal_closed_at })),
    worktreesOpen: one(machine, 'SELECT count(*) AS n FROM worktrees WHERE ledger_id=? AND workflow_id=? AND removed_at IS NULL', row.ledgerId, wf)?.n ?? 0,
    worktreesRemoved: one(machine, 'SELECT count(*) AS n FROM worktrees WHERE ledger_id=? AND workflow_id=? AND removed_at IS NOT NULL', row.ledgerId, wf)?.n ?? 0 };
}
function unitRow(db, unit, project) {
  const current = unit.last_attempt_id == null ? null : one(db, 'SELECT * FROM v_op_history WHERE attempt_id=?', unit.last_attempt_id);
  return { unit: unit.unit_id, workflowId: unit.workflow_id, op: unit.op_id, title: unit.title ?? unit.unit_id, state: unit.state, ui: unit.ui,
    goalRevision: unit.goal_revision, subjectKey: unit.subject_key, currentJob: unit.current_job_id,
    attempts: unit.dispatches, tries: unit.tries, tryBudget: unit.try_budget, current: current ? attemptRow(current, project, db) : null,
    updatedAt: unit.updated_at, doneAt: unit.done_at };
}
function graph(db, project, wf) {
  const units = many(db, 'SELECT * FROM v_units WHERE workflow_id=? ORDER BY created_at,unit_id', wf);
  const nodes = units.map(u => ({ unit: u.unit_id, op: u.op_id, title: u.title ?? u.unit_id, ui: u.ui, state: u.state,
    workflowId: u.workflow_id, goalRevision: u.goal_revision, subjectKey: u.subject_key, currentJob: u.current_job_id,
    attempts: u.dispatches, cut: u.cut_ordinal == null ? null : { ordinal: u.cut_ordinal, total: u.cut_total }, href: hrefOf('unit', u.unit_id, project, wf) }));
  const edges = many(db, 'SELECT from_unit,to_unit,kind,source,created_at FROM unit_edges WHERE workflow_id=? ORDER BY from_unit,to_unit,kind', wf).map(e => ({ from: e.from_unit, to: e.to_unit, kind: e.kind, source: e.source, createdAt: e.created_at }));
  const groups = [...new Set(nodes.map(n => n.op))].map(op => {
    const selected = nodes.filter(n => n.op === op);
    return { op, total: selected.length, byUi: Object.fromEntries([...new Set(selected.map(n => n.ui))].map(ui => [ui, selected.filter(n => n.ui === ui).length])) };
  });
  return { nodes, edges, groups };
}
function unitDetail(db, project, wf, unitId) {
  const unit = one(db, 'SELECT * FROM v_units WHERE workflow_id=? AND unit_id=?', wf, unitId);
  if (!unit) return null;
  const edges = many(db, 'SELECT from_unit,to_unit,kind,source,created_at FROM unit_edges WHERE workflow_id=? AND (from_unit=? OR to_unit=?) ORDER BY from_unit,to_unit,kind', wf, unitId, unitId);
  const decisions = many(db, "SELECT * FROM decisions WHERE workflow_id=? AND subject_type='unit' AND subject_id=? ORDER BY decided_at DESC", wf, unitId);
  const blockers = many(db, "SELECT * FROM v_blocking WHERE workflow_id=? AND entity_type='unit' AND entity_id=?", wf, unitId);
  return { unit: unitRow(db, unit, project),
    attempts: many(db, 'SELECT * FROM v_op_history WHERE workflow_id=? AND unit_id=? ORDER BY attempt_id DESC', wf, unitId).map(a => attemptRow(a, project, db)),
    edges: { in: edges.filter(e => e.to_unit === unitId).map(e => ({ ...ref('unit', e.from_unit, project, wf), from: e.from_unit, to: e.to_unit, kind: e.kind, source: e.source, createdAt: e.created_at })),
      out: edges.filter(e => e.from_unit === unitId).map(e => ({ ...ref('unit', e.to_unit, project, wf), from: e.from_unit, to: e.to_unit, kind: e.kind, source: e.source, createdAt: e.created_at })) },
    decisions: decisions.map(d => ({ id: d.decision_id, choice: d.choice, rationale: d.rationale, result: parse(d.result_json), at: d.decided_at })),
    blockedBy: blockers.map(b => ({ ref: blockerRef(b, project, wf), ui: b.blocker_type === 'unit' ? 'waiting' : 'warn', reason: reason(b.reason_code, {}, b.detail ?? undefined), since: b.since })) };
}
function decisionLog(store, url) {
  const machine = store.machine.db;
  const project = url.searchParams.get('project');
  const wf = url.searchParams.get('wf');
  const decider = url.searchParams.get('decider');
  const rows = ledgerRows(store, (ledger, db) => {
    if (project && project !== ledger.name && project !== ledger.ledgerId) return [];
    return many(db, 'SELECT * FROM decisions WHERE (? IS NULL OR workflow_id=?) ORDER BY decided_at DESC', wf, wf).map(d => ({
      id: d.decision_id, store: 'ledger', ledgerId: ledger.ledgerId, workflowId: d.workflow_id, key: JSON.stringify(['ledger', ledger.ledgerId, d.decision_id]), decider: d.decider, di: d.di_id ? ref('di', d.di_id, ledger.name) : null,
      subject: d.subject_type && d.subject_id ? ref(decisionSubjectType(d.subject_type, true), d.subject_id, ledger.name, d.workflow_id) : null,
      choice: d.choice, rationale: d.rationale, result: parse(d.result_json), at: d.decided_at,
    }));
  });
  const ledgerId = project ? store.projects().find(row => row.name === project || row.ledgerId === project)?.ledgerId ?? null : null;
  rows.push(...many(machine, 'SELECT * FROM sup_decisions WHERE (? IS NULL OR workflow_id=?) AND (? IS NULL OR ledger_id=?) ORDER BY decided_at DESC', wf, wf, ledgerId, ledgerId).filter(d => !project || d.ledger_id === ledgerId).map(d => ({
    id: d.decision_id, store: 'machine', ledgerId: d.ledger_id, workflowId: d.workflow_id, key: JSON.stringify(['machine', d.ledger_id, d.decision_id]), decider: d.decider, di: d.di_id ? ref('di', d.di_id) : null,
    subject: d.subject_type && d.subject_id ? ref(decisionSubjectType(d.subject_type, false), d.subject_id,
      store.projects().find(projectRow => projectRow.ledgerId === d.ledger_id)?.name ?? null, d.workflow_id) : null,
    choice: d.choice, rationale: d.rationale, result: parse(d.result_json), at: d.decided_at,
  })));
  return rows.filter(d => !decider || d.decider === decider).sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
}

/** Domain routes for C1–C5. Core owns registration, method policy, and serialization. */
export function handleWork(request, response, store, url) {
  const pathname = url.pathname;
  if (!store.machine) {
    if (pathname.startsWith('/api/workers') || pathname.startsWith('/api/projects') || pathname.startsWith('/api/workflows') || pathname === '/api/decisions/log') {
      sendError(request, response, 503, 'MACHINE_UNAVAILABLE', 'Machine database unavailable'); return true;
    }
    return false;
  }
  if (pathname === '/api/workers') {
    sendJson(request, response, workers(store, url), { sources: [
      ...source('machine', 'v_engine_health', 'v_sla_open', 'invariant_violations', 'v_open_sup_decisions', 'v_seats', 'metrics_snapshots'),
      ...store.projects().flatMap(row => source(row.name, 'v_workflow_progress', 'workflows', 'v_units', 'v_decision_rows', 'jobs', 'goals', 'work_graph_versions', 'logs', 'events', 'v_op_history', 'op_attempts', 'check_runs', 'llm_usage')),
      ...source('runtime', 'modules/ops/ops/*.yaml', 'modules/ops/_common.yaml', 'modules/ops/_labels.yaml')], stale: staleOf(store) });
    return true;
  }
  if (pathname === '/api/projects') {
    sendJson(request, response, projects(store), { sources: [...source('machine', 'ledgers', 'repositories'),
      ...store.projects().flatMap(row => source(row.name, 'workflows'))], stale: staleOf(store) });
    return true;
  }
  if (pathname === '/api/workflows') {
    let rows = workflowRows(store, { project: url.searchParams.get('project') });
    const phase = url.searchParams.get('phase') ?? 'running';
    if (phase !== 'all') rows = rows.filter(row => row.phase === phase);
    const ui = url.searchParams.get('ui'), q = url.searchParams.get('q')?.toLowerCase();
    if (ui) rows = rows.filter(row => row.ui === ui);
    if (q) rows = rows.filter(row => `${row.name} ${row.id} ${row.project}`.toLowerCase().includes(q));
    rows.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
    const result = pageData(rows, url);
    sendJson(request, response, result.data, { sources: [...source('machine', 'metrics_snapshots', 'v_seats', 'v_sla_open'),
      ...store.projects().flatMap(row => source(row.name, 'v_workflow_progress', 'workflows', 'v_units', 'v_decision_rows', 'jobs', 'goals', 'work_graph_versions', 'logs', 'events', 'v_op_history', 'op_attempts', 'check_runs')),
      ...source('runtime', 'modules/ops/ops/*.yaml', 'modules/ops/_common.yaml', 'modules/ops/_labels.yaml')], stale: staleOf(store), next: result.next });
    return true;
  }
  if (pathname === '/api/decisions/log') {
    const result = pageData(decisionLog(store, url), url);
    sendJson(request, response, result.data, { sources: [source('machine', 'sup_decisions')[0], ...store.projects().flatMap(row => source(row.name, 'decisions'))], stale: staleOf(store), next: result.next });
    return true;
  }
  const match = /^\/api\/workflows\/([^/]+)\/([^/]+)(?:\/(graph|pipeline|units|rca|worktrees|coverage|verify)(?:\/([^/]+))?)?$/.exec(pathname);
  if (!match) return false;
  let project, wf, extra;
  try { project = decodeURIComponent(match[1]); wf = decodeURIComponent(match[2]); extra = match[4] ? decodeURIComponent(match[4]) : null; }
  catch { sendError(request, response, 400, 'BAD_PATH', 'Invalid path encoding'); return true; }
  const target = store.ledger(project);
  if (!target) {
    const registered = store.projects().some(row => row.name === project || row.ledgerId === project);
    sendError(request, response, registered ? 503 : 404, registered ? 'LEDGER_UNAVAILABLE' : 'NOT_FOUND', registered ? 'Registered project ledger is unavailable' : 'Project not found');
    return true;
  }
  const { row, db } = target;
  if (!one(db, 'SELECT workflow_id FROM workflows WHERE workflow_id=?', wf)) { sendError(request, response, 404, 'NOT_FOUND', 'Workflow not found'); return true; }
  const route = match[3] ?? 'detail';
  if (route === 'detail') {
    sendJson(request, response, detail(store, row, db, wf), { sources: [
      ...source(row.name, 'workflows', 'lifecycle_changes', 'goals', 'v_workflow_progress', 'v_units', 'v_blocking', 'v_decision_rows', 'incidents', 'v_op_history', 'op_attempts', 'check_runs', 'jobs', 'work_graph_versions', 'logs', 'events', 'llm_usage'),
      ...source('runtime', 'modules/ops/ops/*.yaml', 'modules/ops/_common.yaml', 'modules/ops/_labels.yaml'),
      ...source('machine', 'metrics_snapshots', 'v_seats', 'v_sla_open')], stale: staleOf(store) });
    return true;
  }
  if (route === 'graph') {
    sendJson(request, response, graph(db, row.name, wf), { sources: source(row.name, 'v_units', 'unit_edges', 'v_op_history'), stale: staleOf(store) }); return true;
  }
  if (route === 'pipeline') {
    sendJson(request, response, { ...pipelineOf(db, row.name, wf), usage: usageDetail(db, { wf }) }, { sources: [...source(row.name, 'goals', 'work_units', 'v_op_history', 'op_attempts', 'check_runs', 'jobs', 'work_graph_versions', 'logs', 'events', 'llm_usage'), ...source('runtime', 'modules/ops/ops/*.yaml', 'modules/ops/_common.yaml', 'modules/ops/_labels.yaml')], stale: staleOf(store) }); return true;
  }
  if (route === 'units') {
    if (extra) {
      const item = unitDetail(db, row.name, wf, extra);
      if (!item) { sendError(request, response, 404, 'NOT_FOUND', 'Unit not found'); return true; }
      sendJson(request, response, item, { sources: source(row.name, 'v_units', 'v_op_history', 'op_attempts', 'check_runs', 'unit_edges', 'decisions', 'v_blocking'), stale: staleOf(store) }); return true;
    }
    let rows = many(db, 'SELECT * FROM v_units WHERE workflow_id=? ORDER BY updated_at DESC,unit_id', wf).map(unit => unitRow(db, unit, row.name));
    const state = url.searchParams.get('state'), op = url.searchParams.get('op'), ui = url.searchParams.get('ui'), q = url.searchParams.get('q')?.toLowerCase();
    if (state) rows = rows.filter(item => item.state === state);
    if (op) rows = rows.filter(item => item.op === op);
    if (ui) rows = rows.filter(item => item.ui === ui);
    if (q) rows = rows.filter(item => `${item.unit} ${item.title} ${item.op}`.toLowerCase().includes(q));
    const result = pageData(rows, url);
    sendJson(request, response, result.data, { sources: source(row.name, 'v_units', 'v_op_history', 'op_attempts', 'check_runs'), stale: staleOf(store), next: result.next }); return true;
  }
  if (route === 'worktrees') {
    const all = url.searchParams.get('all') === '1';
    const rows = many(store.machine.db, 'SELECT * FROM worktrees WHERE ledger_id=? AND workflow_id=? ORDER BY created_at DESC', row.ledgerId, wf)
      .filter(item => all || item.removed_at == null).map(item => ({ path: hostPath(item.path), repoRoot: hostPath(item.repo_root), lane: item.lane, port: item.port, attempt: item.attempt_id, kind: item.kind,
        branch: item.branch, baseSha: item.base_sha, headSha: item.head_sha, jobId: item.job_id,
        createdAt: item.created_at, removedAt: item.removed_at, removeError: item.remove_error,
        ui: worktreeUi(item) }));
    const result = pageData(rows, url, { identity: item => item.path });
    sendJson(request, response, result.data, { sources: source('machine', 'worktrees'), stale: staleOf(store), next: result.next }); return true;
  }
  if (['rca', 'coverage', 'verify'].includes(route)) {
    try {
      const recorded = readMetricSnapshot(store.machine, route, row.ledgerId, wf);
      const schemas = { rca: 'starci/rca@1', coverage: 'starci/proof-coverage@1', verify: 'starci/proof-verify@1' };
      if (recorded) metricPayload(recorded, schemas[route]);
      sendJson(request, response, recorded, { sources: [...source('machine', 'metrics_snapshots', 'blobs')], stale: staleOf(store) });
    } catch (error) { sendError(request, response, 502, 'METRIC_SOURCE_FAILED', String(error?.message ?? error)); }
    return true;
  }
  return false;
}
