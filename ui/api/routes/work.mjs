import path from 'node:path';
import { getBlob } from '../../../scripts/lib/artifact-store.mjs';
import { workflowStateOf } from '../../../scripts/kernel/progress-state.mjs';
import { sendJson, sendError } from '../envelope.mjs';
import { uiState } from '../state.mjs';
import { reason } from '../reason.mjs';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const OPEN_DI = "('open','claimed','escalated')";
const source = (db, ...rels) => rels.map(rel => ({ db, rel }));
const many = (db, sql, ...args) => db.prepare(sql).all(...args);
const one = (db, sql, ...args) => db.prepare(sql).get(...args) ?? null;
const parse = (value, fallback = null) => { try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; } };
const staleOf = store => [...store.stale];
const safeLimit = url => Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));
const cursorOf = url => { try { return Math.max(0, Number(JSON.parse(Buffer.from(url.searchParams.get('cursor') ?? '', 'base64url').toString()).offset) || 0); } catch { return 0; } };
const nextOf = offset => Buffer.from(JSON.stringify({ offset })).toString('base64url');
const page = (rows, url) => { const offset = cursorOf(url), limit = safeLimit(url); return { data: rows.slice(offset, offset + limit), next: offset + limit < rows.length ? nextOf(offset + limit) : null }; };
const ref = (kind, id, project = null) => ({ kind, ...(project ? { project } : {}), id: String(id), href: hrefOf(kind, id, project) });
function hrefOf(kind, id, project) {
  const p = encodeURIComponent(project ?? '');
  const key = encodeURIComponent(String(id));
  if (kind === 'workflow') return `#/w/${p}/${key}`;
  if (kind === 'unit') return `#/w/${p}?tab=units&unit=${key}`;
  if (kind === 'attempt') return `#/a/${p}/${key}`;
  if (kind === 'di') return `#/decisions?id=${key}`;
  if (kind === 'violation') return `#/system/sla?id=${key}`;
  if (kind === 'land') return `#/system/land?id=${key}`;
  return '#/';
}
function relativePath(value, root = null) {
  if (!value) return null;
  const normalized = String(value).replaceAll('\\', '/');
  if (!path.isAbsolute(value) && !/^[A-Za-z]:\//.test(normalized)) return normalized;
  if (root) {
    const rel = path.relative(root, value).replaceAll('\\', '/');
    if (rel && rel !== '..' && !rel.startsWith('../') && !path.isAbsolute(rel)) return rel;
  }
  return normalized.split('/').filter(Boolean).slice(-2).join('/');
}
function ledgerRows(store, fn) {
  return store.forEachLedger(({ row, db }) => fn(row, db)).flatMap(entry => entry.error ? [] : entry.result ?? []);
}
function latestMetric(machine, kind, ledgerId, wf) {
  const row = one(machine, 'SELECT at,data_json,data_sha FROM metrics_snapshots WHERE kind=? AND ledger_id=? AND workflow_id=? ORDER BY at DESC,snap_id DESC LIMIT 1', kind, ledgerId, wf);
  if (!row) return null;
  let data = parse(row.data_json);
  if (row.data_sha) { try { data = JSON.parse(getBlob(row.data_sha).toString('utf8')); } catch { /* keep inline data */ } }
  return { at: row.at, ageMs: Math.max(0, Date.now() - row.at), data };
}
function seatOf(machine, project, wf) {
  return one(machine, 'SELECT state,last_seen_at,kernel_rev,acked_rev FROM v_seats WHERE seat_id=?', `kernel:${project}:${wf}`);
}
function workflowRow(store, row, db, progress, extra = {}) {
  const machine = store.machine.db;
  const wf = progress.workflow_id;
  const p = row.name;
  const latest = latestMetric(machine, 'progress', row.ledgerId, wf)?.data ?? {};
  const dIs = many(db, `SELECT di_id,kind,decider,status,due_at,opened_at,summary,ui FROM v_decision_rows WHERE workflow_id=? AND status IN ${OPEN_DI}`, wf);
  const violations = many(machine, 'SELECT code,severity,violated_at,ui FROM v_sla_open WHERE ledger_id=? AND workflow_id=?', row.ledgerId, wf);
  const seat = seatOf(machine, p, wf);
  const jobs = one(db, "SELECT sum(status IN ('leased','running','answering','reported','deciding')) AS running, sum(status='ready') AS queued_ready FROM jobs WHERE workflow_id=?", wf);
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
  const onIt = primaryDI ? { who: primaryDI.decider, ref: ref('di', primaryDI.di_id, p), reason: reason('DECISION_OPEN', { kind: primaryDI.kind ?? 'decision' }) }
    : state.ui === 'warn' || state.ui === 'bad' ? { who: 'kernel', ref: null, reason: state.reason ?? reason('PROGRESS', {}) } : null;
  return {
    project: p, id: wf, name: progress.display_name ?? extra.title ?? wf, phase: progress.phase,
    ui: state.ui, reason: state.reason,
    units: { done: progress.units_done, total: progress.units_total, active: progress.units_active, failed: progress.units_failed },
    ratePerHour: Number(latest.ratePerHour ?? (progress.done_last_6h / 6)),
    minRatePerHour: latest.minRatePerHour ?? null, etaAt: latest.etaAt ?? progress.eta_at,
    running, allowedParallel: current.allowedParallel ?? null, lastUnitAt: progress.last_unit_at,
    onIt, seat: seat ? { state: seat.state, lastSeenAt: seat.last_seen_at } : null,
    updatedAt: extra.updated_at ?? latest.at ?? Date.now(),
  };
}
function workflowRows(store, { project = null } = {}) {
  return ledgerRows(store, (row, db) => {
    if (project && project !== row.name) return [];
    const rows = many(db, 'SELECT p.*,w.phase_reason,w.created_at,w.updated_at,w.title FROM v_workflow_progress p JOIN workflows w ON w.workflow_id=p.workflow_id');
    return rows.map(progress => workflowRow(store, row, db, progress, progress));
  });
}
function attention(store) {
  const machine = store.machine.db;
  const ledgerNames = new Map(store.projects().map(row => [row.ledgerId, row.name]));
  const items = ledgerRows(store, (row, db) => many(db, `SELECT * FROM v_decision_rows WHERE status IN ${OPEN_DI} AND ui IN ('bad','warn')`).map(di => ({
    ref: ref('di', di.di_id, row.name), ui: di.ui, reason: reason(di.overdue ? 'DECISION_OVERDUE' : 'DECISION_OPEN', { kind: di.kind }),
    age: Math.max(0, Date.now() - di.opened_at), who: di.decider, since: di.opened_at,
  })));
  for (const di of many(machine, "SELECT * FROM v_open_sup_decisions WHERE ui IN ('bad','warn')")) items.push({
    ref: ref('di', di.di_id), ui: di.ui, reason: reason(di.ui === 'bad' ? 'DECISION_OVERDUE' : 'DECISION_OPEN', { kind: di.kind }),
    age: Math.max(0, Date.now() - di.opened_at), who: 'supervisor', since: di.opened_at,
  });
  for (const row of many(machine, 'SELECT * FROM invariant_violations WHERE cleared_at IS NULL')) items.push({
    ref: ref('violation', row.violation_id, ledgerNames.get(row.ledger_id)), ui: row.severity === 'critical' ? 'bad' : 'warn',
    reason: reason(row.code, {}), age: Math.max(0, Date.now() - row.violated_at), who: 'controller', since: row.violated_at,
  });
  items.sort((a, b) => Number(b.ui === 'bad') - Number(a.ui === 'bad') || a.since - b.since);
  return items.slice(0, 10).map(({ since, ...item }) => item);
}
function compactHealth(machine) {
  const engine = one(machine, 'SELECT ui FROM v_engine_health');
  const critical = one(machine, "SELECT count(*) AS n FROM v_sla_open WHERE ui='bad'")?.n ?? 0;
  const warning = one(machine, "SELECT count(*) AS n FROM v_sla_open WHERE ui='warn'")?.n ?? 0;
  const items = [
    { key: 'engine', ui: engine?.ui ?? 'unknown', value: engine?.ui ?? 'unknown', reason: null, href: '#/system/engine' },
    { key: 'sla', ui: critical ? 'bad' : warning ? 'warn' : 'ok', value: String(critical + warning),
      reason: critical ? reason('SLA_CRITICAL', { count: critical }) : warning ? reason('SLA_WARNING', { count: warning }) : null,
      href: '#/system/sla' },
  ];
  return { ui: items.some(item => item.ui === 'bad') ? 'bad' : items.some(item => item.ui === 'warn') ? 'warn' : 'ok', items };
}
function fleet(store, url) {
  const workflows = workflowRows(store).filter(row => url.searchParams.get('phase') === 'all' || !['finished', 'archived'].includes(row.phase));
  const attentionRows = attention(store);
  const machine = store.machine.db;
  const violationsOpen = one(machine, 'SELECT count(*) AS n FROM invariant_violations WHERE cleared_at IS NULL')?.n ?? 0;
  const health = compactHealth(machine);
  return { attention: attentionRows, workflows, health, counts: {
    live: workflows.filter(row => row.phase === 'running').length,
    bad: workflows.filter(row => row.ui === 'bad').length,
    warn: workflows.filter(row => row.ui === 'warn').length,
    ownerDecisions: ledgerRows(store, (_row, db) => [one(db, "SELECT count(*) AS n FROM decision_items WHERE decider='owner' AND status IN ('open','claimed','escalated')")?.n ?? 0]).reduce((a, b) => a + b, 0),
    violationsOpen,
  } };
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
function blockerRef(blocker, project) {
  const kind = blocker.blocker_type === 'decision' ? 'di' : blocker.blocker_type === 'unit' ? 'unit' : blocker.blocker_type === 'incident' ? 'incident' : 'workflow';
  return ref(kind, blocker.blocker_id, project);
}
function blockedBy(store, row, db, wf) {
  const machine = store.machine.db;
  const rows = many(db, 'SELECT * FROM v_blocking WHERE workflow_id=?', wf).map(blocker => ({
    ref: blockerRef(blocker, row.name), ui: blocker.blocker_type === 'decision' ? 'warn' : 'waiting',
    reason: reason(blocker.reason_code, {}, blocker.detail ?? undefined), since: blocker.since, who: blocker.who,
    sort: blocker.blocker_type === 'decision' ? 0 : blocker.blocker_type === 'condition' ? 3 : blocker.blocker_type === 'unit' ? 4 : 3,
  }));
  const diById = new Map(many(db, `SELECT di_id,ui,overdue FROM v_decision_rows WHERE workflow_id=? AND status IN ${OPEN_DI}`, wf).map(di => [di.di_id, di]));
  for (const item of rows) if (item.ref.kind === 'di') { const di = diById.get(item.ref.id); if (di) { item.ui = di.ui; item.sort = di.overdue || di.ui === 'bad' ? -1 : 0; } }
  for (const sla of many(machine, 'SELECT * FROM v_sla_open WHERE ledger_id=? AND workflow_id=?', row.ledgerId, wf)) rows.push({
    ref: ref('violation', sla.episode_id, row.name), ui: sla.ui, reason: reason(sla.code, {}),
    since: sla.entered_at, who: 'controller', sort: 1,
  });
  for (const unit of many(db, "SELECT unit_id,updated_at FROM work_units WHERE workflow_id=? AND state='failed'", wf)) rows.push({
    ref: ref('unit', unit.unit_id, row.name), ui: 'bad', reason: reason('UNIT_FAILED', {}),
    since: unit.updated_at, who: 'kernel', sort: 2,
  });
  rows.sort((a, b) => a.sort - b.sort || a.since - b.since);
  return rows.map(({ sort, ...item }) => item);
}
function detail(store, row, db, wf) {
  const p = one(db, 'SELECT p.*,w.phase_reason,w.created_at,w.updated_at,w.title FROM v_workflow_progress p JOIN workflows w ON w.workflow_id=p.workflow_id WHERE p.workflow_id=?', wf);
  if (!p) return null;
  const base = workflowRow(store, row, db, p, p);
  const goal = one(db, 'SELECT markdown,revision,created_at FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1', wf);
  const lifecycle = one(db, 'SELECT reason FROM lifecycle_changes WHERE workflow_id=? ORDER BY change_id DESC LIMIT 1', wf);
  const seat = seatOf(store.machine.db, row.name, wf);
  const now = Date.now();
  const counts = {
    decisionsOpen: one(db, `SELECT count(*) AS n FROM decision_items WHERE workflow_id=? AND status IN ${OPEN_DI}`, wf)?.n ?? 0,
    incidentsOpen: one(db, "SELECT count(*) AS n FROM incidents WHERE workflow_id=? AND status='open'", wf)?.n ?? 0,
    violationsOpen: one(store.machine.db, 'SELECT count(*) AS n FROM v_sla_open WHERE ledger_id=? AND workflow_id=? AND violated_at IS NOT NULL', row.ledgerId, wf)?.n ?? 0,
    failed24h: one(db, "SELECT count(*) AS n FROM v_op_history WHERE workflow_id=? AND verdict='fail' AND settled_at>=?", wf, now - DAY)?.n ?? 0,
    attempts24h: one(db, 'SELECT count(*) AS n FROM v_op_history WHERE workflow_id=? AND dispatched_at>=?', wf, now - DAY)?.n ?? 0,
    costUsd24h: one(db, 'SELECT sum(cost_usd) AS cost FROM llm_usage WHERE workflow_id=? AND at>=?', wf, now - DAY)?.cost ?? null,
  };
  return { ...base, goal: goal ? { text: goal.markdown, revision: goal.revision, at: goal.created_at } : { text: '', revision: 0, at: p.created_at },
    phaseReason: p.phase_reason ?? lifecycle?.reason ?? null,
    kernelRev: seat ? { current: seat.kernel_rev ?? '', acked: seat.acked_rev ?? null, stale: Boolean(seat.kernel_rev && seat.acked_rev && seat.kernel_rev !== seat.acked_rev) } : null,
    blockedBy: blockedBy(store, row, db, wf), counts,
  };
}
function attemptRow(row, project) {
  if (!row) return null;
  return { project, id: row.attempt_id, wf: row.workflow_id, unit: row.unit_id, job: row.job_id, op: row.op_id,
    attempt: row.try_no, dispatchSeq: row.dispatch_seq, agent: row.agent, model: row.model, pool: row.pool, effort: row.effort,
    dispatchedAt: row.dispatched_at, reportedAt: row.reported_at, settledAt: row.settled_at, cycleMs: row.cycle_ms,
    reportOutcome: row.report_outcome, verdict: row.verdict, settledBy: row.settled_by, failureClass: row.failure_class,
    endState: row.end_state, ui: row.ui, checks: row.checks, checksRed: row.checks_red, artifacts: row.artifacts,
    tokensIn: row.tokens_in, tokensOut: row.tokens_out, costUsd: row.cost_usd, summary: row.report_summary,
    href: hrefOf('attempt', row.attempt_id, project) };
}
function unitRow(db, unit, project) {
  const current = unit.last_attempt_id == null ? null : one(db, 'SELECT * FROM v_op_history WHERE attempt_id=?', unit.last_attempt_id);
  return { unit: unit.unit_id, op: unit.op_id, title: unit.title ?? unit.unit_id, state: unit.state, ui: unit.ui,
    attempts: unit.dispatches, tries: unit.tries, tryBudget: unit.try_budget, current: attemptRow(current, project),
    updatedAt: unit.updated_at, doneAt: unit.done_at };
}
function graph(db, project, wf) {
  const units = many(db, 'SELECT * FROM v_units WHERE workflow_id=? ORDER BY created_at,unit_id', wf);
  const nodes = units.map(u => ({ unit: u.unit_id, op: u.op_id, title: u.title ?? u.unit_id, ui: u.ui, state: u.state,
    attempts: u.dispatches, cut: u.cut_ordinal == null ? null : { ordinal: u.cut_ordinal, total: u.cut_total }, href: hrefOf('unit', u.unit_id, project) }));
  const edges = many(db, 'SELECT from_unit,to_unit,kind FROM unit_edges WHERE workflow_id=?', wf).map(e => ({ from: e.from_unit, to: e.to_unit, kind: e.kind }));
  const groups = [...new Set(nodes.map(n => n.op))].map(op => {
    const selected = nodes.filter(n => n.op === op);
    return { op, total: selected.length, byUi: Object.fromEntries([...new Set(selected.map(n => n.ui))].map(ui => [ui, selected.filter(n => n.ui === ui).length])) };
  });
  return { nodes, edges, groups };
}
function unitDetail(db, project, wf, unitId) {
  const unit = one(db, 'SELECT * FROM v_units WHERE workflow_id=? AND unit_id=?', wf, unitId);
  if (!unit) return null;
  const edges = many(db, 'SELECT from_unit,to_unit FROM unit_edges WHERE workflow_id=? AND (from_unit=? OR to_unit=?)', wf, unitId, unitId);
  const decisions = many(db, "SELECT * FROM decisions WHERE workflow_id=? AND subject_type='unit' AND subject_id=? ORDER BY decided_at DESC", wf, unitId);
  const blockers = many(db, "SELECT * FROM v_blocking WHERE workflow_id=? AND entity_type='unit' AND entity_id=?", wf, unitId);
  return { unit: unitRow(db, unit, project),
    attempts: many(db, 'SELECT * FROM v_op_history WHERE workflow_id=? AND unit_id=? ORDER BY attempt_id DESC', wf, unitId).map(a => attemptRow(a, project)),
    edges: { in: edges.filter(e => e.to_unit === unitId).map(e => ref('unit', e.from_unit, project)),
      out: edges.filter(e => e.from_unit === unitId).map(e => ref('unit', e.to_unit, project)) },
    decisions: decisions.map(d => ({ id: d.decision_id, choice: d.choice, rationale: d.rationale, result: parse(d.result_json), at: d.decided_at })),
    blockedBy: blockers.map(b => ({ ref: blockerRef(b, project), ui: b.blocker_type === 'unit' ? 'waiting' : 'warn', reason: reason(b.reason_code, {}, b.detail ?? undefined), since: b.since })) };
}
function decisionLog(store, url) {
  const machine = store.machine.db;
  const project = url.searchParams.get('project');
  const wf = url.searchParams.get('wf');
  const decider = url.searchParams.get('decider');
  const rows = ledgerRows(store, (ledger, db) => {
    if (project && project !== ledger.name) return [];
    return many(db, 'SELECT * FROM decisions WHERE (? IS NULL OR workflow_id=?) ORDER BY decided_at DESC', wf, wf).map(d => ({
      id: d.decision_id, decider: d.decider, di: d.di_id ? ref('di', d.di_id, ledger.name) : null,
      subject: d.subject_type && d.subject_id ? ref(d.subject_type === 'unit' ? 'unit' : d.subject_type === 'attempt' ? 'attempt' : 'workflow', d.subject_id, ledger.name) : null,
      choice: d.choice, rationale: d.rationale, result: parse(d.result_json), at: d.decided_at,
    }));
  });
  rows.push(...many(machine, 'SELECT * FROM sup_decisions WHERE (? IS NULL OR workflow_id=?) ORDER BY decided_at DESC', wf, wf).map(d => ({
    id: d.decision_id, decider: d.decider, di: d.di_id ? ref('di', d.di_id) : null,
    subject: d.subject_type && d.subject_id ? ref(d.subject_type === 'unit' ? 'unit' : 'workflow', d.subject_id) : null,
    choice: d.choice, rationale: d.rationale, result: parse(d.result_json), at: d.decided_at,
  })));
  return rows.filter(d => !decider || d.decider === decider).sort((a, b) => b.at - a.at);
}

/** Domain routes for C1–C5. Core owns registration, method policy, and serialization. */
export function handleWork(request, response, store, url) {
  const pathname = url.pathname;
  if (!store.machine) {
    if (pathname.startsWith('/api/fleet') || pathname.startsWith('/api/projects') || pathname.startsWith('/api/workflows') || pathname === '/api/decisions/log') {
      sendError(request, response, 503, 'MACHINE_UNAVAILABLE', 'Machine database unavailable'); return true;
    }
    return false;
  }
  if (pathname === '/api/fleet') {
    sendJson(request, response, fleet(store, url), { sources: [
      ...source('machine', 'v_engine_health', 'v_sla_open', 'invariant_violations', 'v_open_sup_decisions', 'v_seats', 'metrics_snapshots'),
      ...store.projects().flatMap(row => source(row.name, 'v_workflow_progress', 'workflows', 'v_decision_rows'))], stale: staleOf(store) });
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
    const result = page(rows, url);
    sendJson(request, response, result.data, { sources: [...source('machine', 'metrics_snapshots', 'v_seats', 'v_sla_open'),
      ...store.projects().flatMap(row => source(row.name, 'v_workflow_progress', 'workflows'))], stale: staleOf(store), next: result.next });
    return true;
  }
  if (pathname === '/api/decisions/log') {
    const result = page(decisionLog(store, url), url);
    sendJson(request, response, result.data, { sources: [source('machine', 'sup_decisions')[0], ...store.projects().flatMap(row => source(row.name, 'decisions'))], stale: staleOf(store), next: result.next });
    return true;
  }
  const match = /^\/api\/workflows\/([^/]+)\/([^/]+)(?:\/(graph|units|rca|worktrees|coverage|verify)(?:\/([^/]+))?)?$/.exec(pathname);
  if (!match) return false;
  let project, wf, extra;
  try { project = decodeURIComponent(match[1]); wf = decodeURIComponent(match[2]); extra = match[4] ? decodeURIComponent(match[4]) : null; }
  catch { sendError(request, response, 400, 'BAD_PATH', 'Invalid path encoding'); return true; }
  const target = store.ledger(project);
  if (!target) { sendError(request, response, 404, 'NOT_FOUND', 'Project not found'); return true; }
  const { row, db } = target;
  if (!one(db, 'SELECT workflow_id FROM workflows WHERE workflow_id=?', wf)) { sendError(request, response, 404, 'NOT_FOUND', 'Workflow not found'); return true; }
  const route = match[3] ?? 'detail';
  if (route === 'detail') {
    sendJson(request, response, detail(store, row, db, wf), { sources: [
      ...source(row.name, 'workflows', 'lifecycle_changes', 'goals', 'v_workflow_progress', 'v_blocking', 'v_decision_rows', 'incidents', 'v_op_history', 'llm_usage'),
      ...source('machine', 'metrics_snapshots', 'v_seats', 'v_sla_open')], stale: staleOf(store) });
    return true;
  }
  if (route === 'graph') {
    sendJson(request, response, graph(db, row.name, wf), { sources: source(row.name, 'v_units', 'unit_edges', 'v_op_history'), stale: staleOf(store) }); return true;
  }
  if (route === 'units') {
    if (extra) {
      const item = unitDetail(db, row.name, wf, extra);
      if (!item) { sendError(request, response, 404, 'NOT_FOUND', 'Unit not found'); return true; }
      sendJson(request, response, item, { sources: source(row.name, 'v_units', 'v_op_history', 'unit_edges', 'decisions', 'v_blocking'), stale: staleOf(store) }); return true;
    }
    let rows = many(db, 'SELECT * FROM v_units WHERE workflow_id=? ORDER BY updated_at DESC,unit_id', wf).map(unit => unitRow(db, unit, row.name));
    const state = url.searchParams.get('state'), op = url.searchParams.get('op'), ui = url.searchParams.get('ui'), q = url.searchParams.get('q')?.toLowerCase();
    if (state) rows = rows.filter(item => item.state === state);
    if (op) rows = rows.filter(item => item.op === op);
    if (ui) rows = rows.filter(item => item.ui === ui);
    if (q) rows = rows.filter(item => `${item.unit} ${item.title} ${item.op}`.toLowerCase().includes(q));
    const result = page(rows, url);
    sendJson(request, response, result.data, { sources: source(row.name, 'v_units', 'v_op_history'), stale: staleOf(store), next: result.next }); return true;
  }
  if (route === 'worktrees') {
    const all = url.searchParams.get('all') === '1';
    const rows = many(store.machine.db, 'SELECT * FROM worktrees WHERE ledger_id=? AND workflow_id=? ORDER BY created_at DESC', row.ledgerId, wf)
      .filter(item => all || item.removed_at == null).map(item => ({ path: relativePath(item.path, item.repo_root), kind: item.kind,
        branch: item.branch, baseSha: item.base_sha, headSha: item.head_sha, jobId: item.job_id,
        createdAt: item.created_at, removedAt: item.removed_at, removeError: item.remove_error,
        ui: item.remove_error ? 'bad' : item.removed_at ? 'done' : 'running' }));
    sendJson(request, response, rows, { sources: source('machine', 'worktrees'), stale: staleOf(store) }); return true;
  }
  if (['rca', 'coverage', 'verify'].includes(route)) {
    const snapshot = latestMetric(store.machine.db, route, row.ledgerId, wf);
    if (!snapshot) { sendJson(request, response, null, { sources: source('machine', 'metrics_snapshots'), stale: staleOf(store) }); return true; }
    const data = route === 'rca'
      ? { at: snapshot.at, ageMs: snapshot.ageMs, attempts24h: snapshot.data?.attempts24h ?? 0,
        clusters: snapshot.data?.clusters ?? [], actions: snapshot.data?.actions ?? [] }
      : { at: snapshot.at, ageMs: snapshot.ageMs, ...(snapshot.data ?? {}) };
    sendJson(request, response, data, { sources: source('machine', 'metrics_snapshots'), stale: staleOf(store) }); return true;
  }
  return false;
}
