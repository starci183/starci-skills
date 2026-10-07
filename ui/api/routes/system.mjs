import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../engine/yaml.mjs';
import { allocationSettings } from '../../../engine/config.mjs';
import { crashLoopPlan, isPlannedStart, SPAWNED_KIND } from '../../../scripts/reconciler/boot.mjs';
import { reconcilerNumbers } from '../../../scripts/reconciler/state.mjs';
import { slaCatalog, SLA_FILE } from '../../../scripts/reconciler/sla.mjs';
import { sendJson, sendError } from '../envelope.mjs';
import { source, many, one, parse, staleOf, limitOf, page } from '../query.mjs';
import { uiState } from '../state.mjs';
import { reason } from '../reason.mjs';
import { admissionObserved, admissionView } from '../admission-read.mjs';
import { actionRow } from '../action-read.mjs';

const DAY = 86_400_000;
function relative(value, root = null) {
  if (!value) return null;
  const text = String(value).replaceAll('\\', '/');
  if (!path.isAbsolute(value) && !/^[A-Za-z]:\//.test(text)) return text;
  if (root) { const rel = path.relative(root, value).replaceAll('\\', '/'); if (rel && !rel.startsWith('../') && rel !== '..' && !path.isAbsolute(rel)) return rel; }
  return text.split('/').filter(Boolean).slice(-2).join('/');
}
function ref(kind, id, project = null) {
  const p = encodeURIComponent(project ?? ''), key = encodeURIComponent(String(id));
  let href;
  if (kind === 'workflow') href = `#/w/${p}/${key}`;
  else if (kind === 'attempt') href = `#/a/${p}/${key}`;
  else if (kind === 'di') href = `#/decisions?id=${key}`;
  else if (kind === 'terminal' || kind === 'seat' || kind === 'service') href = `#/system/services?target=${kind}&id=${key}`;
  else if (kind === 'land' || kind === 'lane') {
    const target = kind === 'land' ? 'land-run' : 'lane';
    href = `#/system/land?target=${target}&id=${key}`;
  } else href = `#/system/${kind}?id=${key}`;
  return { kind, ...(project ? { project } : {}), id: String(id), href };
}
function blob(machine, sha) {
  if (!sha) return null;
  const row = one(machine, 'SELECT sha256,bytes,media_type,archived_at FROM blobs WHERE sha256=?', sha);
  return row ? { sha: row.sha256, bytes: row.bytes, mediaType: row.media_type, href: `/api/blob/${row.sha256}`, archived: row.archived_at != null } : null;
}
function projectName(store, ledgerId) { return store.projects().find(row => row.ledgerId === ledgerId)?.name ?? null; }
function allLedgers(store, fn) { return store.forEachLedger(({ row, db }) => fn(row, db)).flatMap(entry => entry.error ? [] : entry.result ?? []); }
const aggregateUi = rows => ['bad', 'warn', 'unknown', 'running', 'waiting', 'ok', 'done'].find(ui => rows.some(row => row.ui === ui)) ?? 'unknown';
function ramUiOf(throttle) {
  if (!throttle) return 'unknown';
  if (throttle.mode === 'critical') return 'bad';
  return throttle.mode === 'heavy' ? 'warn' : 'ok';
}
function slaOf(bad, warn) {
  if (bad) return { ui: 'bad', reason: 'SLA_CRITICAL' };
  if (warn) return { ui: 'warn', reason: 'SLA_WARNING' };
  return { ui: 'ok', reason: null };
}
function leakUiOf(leaks, store) {
  if (leaks) return 'warn';
  return store.stale.size ? 'unknown' : 'ok';
}
function health(store) {
  const m = store.machine.db;
  const engine = one(m, 'SELECT ui FROM v_engine_health');
  const serviceRows = store.machine.services(), seatRows = store.machine.seats();
  const badServices = serviceRows.filter(row => row.ui === 'bad').length;
  const badSeats = seatRows.filter(row => row.ui === 'bad').length;
  const throttle = one(m, 'SELECT mode FROM throttle_state WHERE id=1');
  const slaBad = one(m, "SELECT count(*) AS n FROM v_sla_open WHERE ui='bad'")?.n ?? 0;
  const slaWarn = one(m, "SELECT count(*) AS n FROM v_sla_open WHERE ui='warn'")?.n ?? 0;
  const leaks = (one(m, 'SELECT count(*) AS n FROM v_leaks')?.n ?? 0) + allLedgers(store, (_row, db) => [one(db, 'SELECT count(*) AS n FROM v_ledger_leaks')?.n ?? 0]).reduce((a, b) => a + b, 0);
  const gc = one(m, 'SELECT * FROM gc_runs ORDER BY run_id DESC LIMIT 1');
  const land = one(m, "SELECT count(*) AS n FROM land_queue WHERE state IN ('queued','running')")?.n ?? 0;
  const providerRows = store.machine.providerHealth().map(row => ({ ...row, ui: uiState(m, 'provider', row.status) }));
  const providers = providerRows.filter(row => row.ui === 'bad').length;
  const ramUi = ramUiOf(throttle);
  const sla = slaOf(slaBad, slaWarn);
  const leakUi = leakUiOf(leaks, store);
  const item = (key, ui, value, href, code = null) => ({ key, ui, value: value == null ? '—' : String(value), reason: code ? reason(code, { count: value }) : null, href });
  const items = [
    item('engine', engine?.ui ?? 'unknown', engine?.ui ?? 'unknown', '#/system/engine', engine?.ui === 'bad' ? 'ENGINE_BAD' : null),
    item('services', aggregateUi(serviceRows), serviceRows.length ? badServices : null, '#/system/services', badServices ? 'SERVICE_DOWN' : null),
    item('seats', aggregateUi(seatRows), seatRows.length ? badSeats : null, '#/system/services', badSeats ? 'SEAT_BAD' : null),
    item('ram', ramUi, throttle?.mode ?? 'unknown', '#/system/resources', throttle?.mode === 'critical' ? 'RAM_CRITICAL' : null),
    item('sla', sla.ui, slaBad + slaWarn, '#/system/sla', sla.reason),
    item('leaks', leakUi, leaks, '#/system/cleanup', leaks ? 'LEAKS_OPEN' : null),
    item('gc', gc ? gcRun(m, gc).ui : 'unknown', gc?.run_id ?? null, '#/system/cleanup'),
    item('land', land ? 'waiting' : 'ok', land, '#/system/land'),
    item('providers', aggregateUi(providerRows), providerRows.length ? providers : null, '#/system/resources', providers ? 'PROVIDER_UNAVAILABLE' : null),
  ];
  return { ui: aggregateUi(items), items };
}
function reconciler(store) {
  const m = store.machine.db, now = Date.now();
  const engine = one(m, 'SELECT * FROM v_engine_health');
  const leader = one(m, 'SELECT expires_at FROM engine_leader LIMIT 1');
  const starts = many(m, 'SELECT at,reason,ended_at,exit_reason,killed_by FROM v_engine_starts WHERE at>=? ORDER BY at DESC', now - DAY);
  const crashNumbers = reconcilerNumbers().crashLoop;
  const crashRecord = { starts: store.machine.logs({ actor: 'reconciler', kind: SPAWNED_KIND, limit: 200 })
    .filter(row => !isPlannedStart(row.data?.startReason)).map(row => Number(row.at)) };
  const crash = crashLoopPlan(crashRecord, { now, ...crashNumbers });
  const controllers = many(m, 'SELECT * FROM controller_modes ORDER BY controller').map(mode => {
    const queue = one(m, 'SELECT count(*) AS depth,sum(last_error IS NOT NULL) AS failing,min(due_at) AS next_due_at FROM engine_queue WHERE controller=?', mode.controller);
    const acts = many(m, 'SELECT state,count(*) AS n FROM v_engine_actions WHERE controller=? AND started_at>=? GROUP BY state', mode.controller, now - DAY);
    const counts = Object.fromEntries(acts.map(x => [x.state, x.n]));
    const last = one(m, 'SELECT started_at,error_signature,state,ui FROM v_engine_actions WHERE controller=? ORDER BY started_at DESC LIMIT 1', mode.controller);
    let ui = last?.ui ?? 'unknown';
    if (last?.ui === 'bad') ui = 'bad';
    else if (mode.mode === 'shadow' || mode.mode === 'off') ui = 'waiting';
    return { name: mode.controller, mode: mode.mode, modeSetAt: mode.set_at, modeSetBy: mode.set_by,
      queue: { depth: queue?.depth ?? 0, failing: queue?.failing ?? 0, nextDueAt: queue?.next_due_at ?? null },
      actions24h: Object.fromEntries(['intent', 'running', 'done', 'failed', 'unknown', 'fenced'].map(state => [state, counts[state] ?? 0])),
      lastActionAt: last?.started_at ?? null,
      lastError: last && ['failed', 'unknown'].includes(last.state) ? { at: last.started_at, text: last.error_signature ?? 'Action failed' } : null,
      ui };
  });
  const schedules = many(m, 'SELECT * FROM v_schedules ORDER BY controller,duty').map(row => ({ controller: row.controller, duty: row.duty,
    intervalMs: row.interval_ms, lastStartedAt: row.last_started_at, lastResult: row.last_result,
    nextDueAt: row.next_due_at, runs24h: row.runs_24h, ui: row.ui }));
  return { leader: engine ? { holder: engine.holder, epoch: engine.epoch, heartbeatAt: engine.heartbeat_at,
    heartbeatAgeMs: engine.heartbeat_age_ms, expiresAt: leader?.expires_at ?? 0, rev: engine.rev, draining: Boolean(engine.draining),
    passes: engine.passes, lastPassMs: engine.last_pass_ms, lastError: engine.last_error, ui: engine.ui } : null,
    starts24h: starts.map(row => ({ at: row.at, reason: row.reason, endedAt: row.ended_at, exitReason: row.exit_reason, killedBy: row.killed_by })),
    crashLoop: crash.looping,
    startsLastHour: engine?.starts_last_hour ?? 0, badExits24h: engine?.bad_exits_24h ?? 0,
    queueDepth: engine?.queue_depth ?? 0, openViolations: engine?.open_violations ?? 0, controllers, schedules };
}
function services(machine) { return machine.services().map(row => {
  const probe = one(machine.db, 'SELECT * FROM service_probes WHERE name=? ORDER BY at DESC,probe_id DESC LIMIT 1', row.name);
  return { name: row.name, kind: row.kind, state: row.state, ui: row.ui, since: row.since,
    restarts24h: row.restarts_24h, failedProbes24h: row.failed_probes_24h,
    lastProbe: probe ? { at: probe.at, ok: Boolean(probe.ok), latencyMs: probe.latency_ms, detail: parse(probe.detail_json) } : null,
    port: row.port, url: row.url, quarantinedUntil: row.quarantined_until };
}); }
function seats(store) { const m = store.machine.db; const deaf = new Set(many(m, 'SELECT seat_id FROM v_deaf_seats').map(x => x.seat_id));
  return store.machine.seats().map(row => {
    const snapshot = one(m, 'SELECT sha256 FROM seat_transcript_snapshots WHERE seat_id=? ORDER BY at DESC,snapshot_id DESC LIMIT 1', row.seat_id);
    return { id: row.seat_id, role: row.role, project: projectName(store, row.ledger_id), wf: row.workflow_id,
      state: row.state, parkedReason: row.parked_reason, ui: row.ui,
      terminal: row.terminal_handle ? ref('terminal', row.terminal_handle) : null,
      agent: row.agent, model: row.model, bootedAt: row.booted_at, lastSeenAt: row.last_seen_at,
      replacedCount: row.replaced_count, inputFailuresConsecutive: row.input_failures_consecutive,
      deaf: deaf.has(row.seat_id), lastSnapshotAt: row.last_snapshot_at, transcript: blob(m, snapshot?.sha256) };
  });
}
// The shells the GC has sighted (machine.sqlite terminals: role shell/other only). Worker terminals are Orca's to account for.
function terminals(store, url) { const m = store.machine.db; return many(m, 'SELECT * FROM terminals ORDER BY opened_at DESC').filter(row =>
  (url.searchParams.get('open') !== '1' || row.closed_at == null) && (!url.searchParams.get('role') || row.role === url.searchParams.get('role'))).map(row => ({
    handle: row.handle, title: row.title, role: row.role,
    openedAt: row.opened_at, closedAt: row.closed_at, closeVerifiedAt: row.close_verified_at, closedBy: row.closed_by,
    ui: row.closed_at ? 'done' : 'running' })); }
function serviceTarget(store, url) {
  const id = url.searchParams.get('id'), kind = url.searchParams.get('target');
  if (!id) return null;
  if (!kind || kind === 'service') { const row = services(store.machine).find(row => row.name === id); if (row) return { kind: 'service', row }; }
  if (!kind || kind === 'seat') { const row = seats(store).find(row => row.id === id); if (row) return { kind: 'seat', row }; }
  if (!kind || kind === 'terminal') {
    const row = one(store.machine.db, 'SELECT * FROM terminals WHERE handle=?', id);
    if (row) return { kind: 'terminal', row: { handle: row.handle, title: row.title, role: row.role,
      openedAt: row.opened_at, closedAt: row.closed_at, closeVerifiedAt: row.close_verified_at, closedBy: row.closed_by,
      ui: row.closed_at ? 'done' : 'running' } };
  }
  return null;
}
function resources(store) {
  const machine = store.machine.db, reader = store.machine;
  const state = reader.throttleState();
  const recent = many(machine, 'SELECT at,from_mode,to_mode,reason FROM throttle_events ORDER BY seq DESC LIMIT 20').map(row => ({ at: row.at, from: row.from_mode, to: row.to_mode, reason: row.reason }));
  const pools = reader.poolBackoff().map(row => ({ pool: row.pool, untilAt: row.until_at, strikes: row.strikes, reason: row.reason, observedAt: row.updated_at,
    ui: row.until_at && row.until_at > Date.now() ? 'warn' : 'ok' }));
  const providers = reader.providerHealth().map(row => ({ provider: row.provider, status: row.status, observedAt: row.updated_at,
    failureKind: row.failure_kind, strikes: row.strikes, circuitOpenUntil: row.circuit_open_until, reason: row.reason,
    ui: uiState(machine, 'provider', row.status) }));
  const quotas = reader.quotas().map(row => {
    let ui = 'ok';
    if (row.limit_value == null || row.used == null) ui = 'unknown';
    else if (row.used >= row.limit_value) ui = 'warn';
    return { provider: row.provider, window: row.window,
      used: row.used, limit: row.limit_value, resetAt: row.reset_at, observedAt: row.observed_at, ui };
  });
  const leaseRows = reader.hostLeases();
  const leases = many(machine, 'SELECT * FROM host_resources').map(row => { const holders = leaseRows.filter(lease => lease.resource_key === row.resource_key);
    return { resource: row.resource_key, capacity: row.capacity, used: holders.reduce((n, x) => n + x.units, 0),
      holders: holders.map(x => ref('workflow', x.workflow_id, projectName(store, x.ledger_id) ?? x.ledger_id)) }; });
  const budgets = reader.budgets().map(row => ({ scope: row.scope_key, limit: row.limit_value, observedAt: row.updated_at,
    used: row.used_value, reserved: row.reserved_value, window: row.window,
    ui: row.used_value + row.reserved_value >= row.limit_value ? 'warn' : 'ok' }));
  const deferred = many(machine, 'SELECT * FROM throttle_decisions ORDER BY seq DESC LIMIT 100').map(row => ({ at: row.at,
    project: projectName(store, row.ledger_id), wf: row.workflow_id, workflow: row.workflow_id && row.ledger_id ? ref('workflow', row.workflow_id, projectName(store, row.ledger_id) ?? row.ledger_id) : null,
    job: row.job_id, reason: row.reason, waitedMs: row.waited_ms, releasedAt: row.released_at }));
  return { admission: admissionView(machine), throttle: { mode: state?.mode ?? 'unknown', effectiveCap: state?.effective_cap ?? null, running: state?.running ?? null,
    freeRamPct: state?.free_ram_pct ?? null, cpuPct: state?.cpu_pct ?? null, since: state?.since ?? null, observedAt: state?.updated_at ?? null,
    reason: state?.reason ?? null, priorities: parse(state?.priorities_json),
    ui: state ? uiState(machine, 'throttle', state.mode) : 'unknown', recent }, pools, providers, quotas, leases, budgets, deferred };
}
function gcRun(machine, row) {
  let ui = 'running';
  if (row.finished_at) ui = parse(row.errors_json, []).length ? 'warn' : 'done';
  return { id: row.run_id, startedAt: row.started_at, finishedAt: row.finished_at,
  trigger: row.trigger, freedBytes: row.freed_bytes, counts: parse(row.counts_json, {}), errors: parse(row.errors_json, []).length,
  report: blob(machine, row.report_sha), ui };
}
function leaks(store) {
  const machine = store.machine.db;
  const rows = many(machine, 'SELECT * FROM v_leaks').map(item => ({ kind: item.kind, target: relative(item.target),
    project: projectName(store, item.ledger_id), since: item.since, owner: item.owner ? ref('workflow', item.owner, projectName(store, item.ledger_id)) : null }));
  rows.push(...allLedgers(store, (ledger, db) => many(db, 'SELECT * FROM v_ledger_leaks').map(item => ({ kind: item.kind,
    target: relative(item.target), project: ledger.name, since: item.due_at,
    owner: item.workflow_id ? ref('workflow', item.workflow_id, ledger.name) : null }))));
  return rows.sort((a, b) => a.since - b.since);
}
function landRun(machine, row) { return { scope: 'runtime', id: row.run_id, ticket: row.ticket_id, lane: row.lane, commit: row.commit_sha,
  landedSha: row.landed_sha, result: row.result, ui: uiState(machine, 'land', row.result), reason: row.reason,
  specs: parse(row.specs_json), push: row.push_id ? { kind: 'land', id: String(row.push_id), href: `#/system/land?target=push&id=${row.push_id}` } : null,
  stdout: blob(machine, row.stdout_sha), stderr: blob(machine, row.stderr_sha),
  startedAt: row.started_at, finishedAt: row.finished_at }; }
function landTicket(machine, row) { return { scope: 'runtime', ticket: row.ticket_id,
    lane: row.lane, commit: row.commit_sha, state: row.state, enqueuedAt: row.enqueued_at,
    gateAt: row.gate_at, busyHolder: row.busy_holder, startedAt: row.started_at, ui: uiState(machine, 'land', row.state) }; }
function laneRow(machine, row) { return { scope: 'runtime', name: row.name, worktree: relative(row.worktree_path), branch: row.branch,
  baseSha: row.base_sha, headSha: row.head_sha, owner: row.owner, supJob: null, supJobId: row.sup_job_id ?? null,
  state: row.state, ui: uiState(machine, 'lane', row.state), createdAt: row.created_at, landedAt: row.landed_at, removedAt: row.removed_at, report: blob(machine, row.report_sha) }; }
function pushRow(store, row) {
  const m = store.machine.db, repo = one(m, 'SELECT name,role,ledger_id FROM repositories WHERE repo_root=?', row.repo_root);
  let scope = 'unknown';
  if (repo?.role === 'runtime') scope = 'runtime';
  else if (['backend', 'frontend', 'service'].includes(repo?.role)) scope = 'project';
  return { id: row.push_id, repo: repo?.name ?? relative(row.repo_root), repoRole: repo?.role ?? null,
    scope,
    project: repo?.ledger_id ? projectName(store, repo.ledger_id) : null,
    branch: row.branch, head: row.head, from: row.from_sha, to: row.to_sha, result: row.result, reason: row.reason,
    failureSignature: row.failure_signature, stdout: blob(m, row.stdout_sha), stderr: blob(m, row.stderr_sha),
    at: row.at, ui: uiState(m, 'push', row.result) };
}
function land(store) { const m = store.machine.db; return {
  queue: many(m, 'SELECT * FROM land_queue ORDER BY enqueued_at DESC LIMIT 100').map(row => landTicket(m, row)),
  recent: many(m, 'SELECT * FROM land_runs ORDER BY run_id DESC LIMIT 20').map(row => landRun(m, row)),
  pushes: many(m, 'SELECT * FROM pushes ORDER BY push_id DESC LIMIT 20').map(row => pushRow(store, row)) };
}
function landTarget(store, url) {
  const m = store.machine.db, id = url.searchParams.get('id'), kind = url.searchParams.get('target');
  if (!id) return null;
  const get = (target, sql, args, project) => {
    if (kind && kind !== target) return null;
    const row = one(m, sql, ...args);
    return row ? { kind: target, row: project(row) } : null;
  };
  return (/^\d+$/.test(id) ? get('land-run', 'SELECT * FROM land_runs WHERE run_id=?', [Number(id)], row => landRun(m, row)) : null)
    ?? get('land-ticket', 'SELECT * FROM land_queue WHERE ticket_id=?', [id], row => landTicket(m, row))
    ?? get('lane', 'SELECT * FROM lanes WHERE name=?', [id], row => laneRow(m, row))
    ?? get('commit', 'SELECT * FROM land_runs WHERE commit_sha=? OR landed_sha=? ORDER BY run_id DESC LIMIT 1', [id, id], row => landRun(m, row))
    ?? (/^(?:push:)?\d+$/.test(id) ? get('push', 'SELECT * FROM pushes WHERE push_id=?', [Number(id.replace(/^push:/, ''))], row => pushRow(store, row)) : null);
}
function supervisor(store) { const m = store.machine.db; const seat = seats(store).find(row => row.id === 'supervisor') ?? null;
  const di = many(m, 'SELECT * FROM v_open_sup_decisions');
  const owed = many(m, "SELECT * FROM sup_owed WHERE state IN ('open','acked') ORDER BY opened_at").map(row => ({ id: row.owed_id,
    kind: row.kind, subject: row.subject, openedAt: row.opened_at, dueAt: row.due_at, acked: row.state === 'acked',
    ui: uiState(m, 'owed', row.state) }));
  return { seat, decisionsOpen: di.length, overdue: di.filter(row => row.ui === 'bad').length,
    undelivered: di.filter(row => row.delivered_at == null).length, owed,
    workersActive: one(m, "SELECT count(*) AS n FROM sup_jobs WHERE status IN ('spawning','running','reported','landing')")?.n ?? 0,
    lastDigestAt: one(m, "SELECT max(sent_at) AS at FROM notifications WHERE kind='digest'")?.at ?? null,
    urgent24h: one(m, "SELECT count(*) AS n FROM notifications WHERE kind='urgent' AND sent_at>=?", Date.now() - DAY)?.n ?? 0 };
}
function catalog() {
  const document = parseYaml(fs.readFileSync(SLA_FILE, 'utf8'));
  if (!document?.codes || typeof document.codes !== 'object' || Array.isArray(document.codes) || !Object.keys(document.codes).length)
    throw new Error('SLA catalog has no readable code definitions');
  const resolved = slaCatalog({ file: SLA_FILE, allocation: allocationSettings() });
  if (Object.keys(resolved.codes).length !== Object.keys(document.codes).length) throw new Error('SLA catalog could not be resolved');
  return Object.values(resolved.codes).map(value => ({ code: value.code, state: value.code, slaMs: value.slaMs,
    warnMs: null, criticalMs: value.criticalMs, severity: value.severity, owner: value.owner, autoAction: value.autoAction }));
}

const failure = (status, code, message) => ({ failure: { status, code, message } });
const pageOf = (rows, url, sources) => { const result = page(rows, url); return { data: result.rows, next: result.next, sources }; };
const filterParams = (rows, url, pairs) => {
  let out = rows;
  for (const [param, field] of pairs) if (url.searchParams.has(param)) out = out.filter(row => row[field] === url.searchParams.get(param));
  return out;
};
const byProject = (rows, store, url) => url.searchParams.has('project') ? rows.filter(row => projectName(store, row.ledger_id) === url.searchParams.get('project')) : rows;
const since = (rows, url, field) => url.searchParams.has('since') ? rows.filter(row => row[field] >= Number(url.searchParams.get('since'))) : rows;
const projectSources = (store, rel) => store.projects().flatMap(row => source(row.name, rel));

function routeHealth({ store }) {
  return { data: health(store), sources: [...source('machine', 'v_engine_health', 'v_services', 'v_seats', 'v_deaf_seats', 'throttle_state', 'provider_health', 'v_sla_open', 'invariant_violations', 'v_leaks', 'gc_runs', 'land_queue'), ...projectSources(store, 'v_ledger_leaks')] };
}
function routeReconciler({ store }) {
  return { data: reconciler(store), sources: source('machine', 'v_engine_health', 'engine_leader', 'leader_history', 'v_engine_starts', 'process_runs', 'machine_logs', 'controller_modes', 'mode_changes', 'engine_queue', 'v_engine_actions', 'v_schedules') };
}
function routeReconcilerActions({ store, url, m }) {
  const rows = since(byProject(filterParams(many(m, 'SELECT * FROM v_engine_actions ORDER BY started_at DESC LIMIT 1000'), url, [['controller', 'controller'], ['state', 'state'], ['wf', 'workflow_id'], ['job', 'job_id']]), store, url), url, 'started_at');
  return pageOf(rows.map(row => actionRow(m, row, { project: projectName(store, row.ledger_id), ref, blob })), url, source('machine', 'v_engine_actions', 'action_steps', 'blobs'));
}
function routeReconcilerQueue({ url, m }) {
  return { data: many(m, 'SELECT * FROM engine_queue ORDER BY due_at').filter(row => !url.searchParams.has('controller') || row.controller === url.searchParams.get('controller')).map(row => ({ controller: row.controller, key: row.key, dueAt: row.due_at, reason: row.reason, tries: row.tries, lastError: row.last_error })), sources: source('machine', 'engine_queue') };
}
function routeSlaViolations({ store, url, m }) {
  let rows = many(m, 'SELECT * FROM invariant_violations ORDER BY violated_at DESC');
  if (url.searchParams.get('open') === '1') rows = rows.filter(row => row.cleared_at == null);
  rows = since(byProject(filterParams(rows, url, [['code', 'code']]), store, url), url, 'violated_at');
  return pageOf(rows.map(row => ({ id: row.violation_id, code: row.code, severity: row.severity,
    entity: { text: row.entity }, project: projectName(store, row.ledger_id), violatedAt: row.violated_at,
    clearedAt: row.cleared_at, di: row.di_id ? ref('di', row.di_id) : null,
    lesson: row.lesson_id ? ref('lesson', row.lesson_id) : null, detail: parse(row.detail_json) })), url, source('machine', 'invariant_violations', 'sla_episodes'));
}
function clockUi(row) {
  if (row.ui != null) return row.ui;
  if (row.cleared_at) return 'done';
  if (row.violated_at) return row.severity === 'critical' ? 'bad' : 'warn';
  return 'waiting';
}
function routeSlaClocks({ store, url, m }) {
  const open = url.searchParams.get('open') !== '0';
  let rows = filterParams(many(m, `SELECT * FROM ${open ? 'v_sla_open' : 'sla_episodes'} ORDER BY entered_at DESC LIMIT 1000`), url, [['state', 'state'], ['code', 'code']]);
  if (url.searchParams.get('violated') === '1') rows = rows.filter(row => row.violated_at != null);
  rows = byProject(rows, store, url);
  return { data: rows.map(row => ({ id: row.episode_id, entity: row.entity, state: row.state, code: row.code,
    severity: row.severity, project: projectName(store, row.ledger_id), wf: row.workflow_id,
    enteredAt: row.entered_at, slaMs: row.sla_ms, dueAt: row.due_at ?? row.entered_at + row.sla_ms,
    violatedAt: row.violated_at, clearedAt: row.cleared_at, clearReason: row.clear_reason,
    di: row.di_id ? ref('di', row.di_id) : null, ui: clockUi(row) })), sources: source('machine', open ? 'v_sla_open' : 'sla_episodes') };
}
function routeSlaCatalog() {
  try { return { data: catalog(), sources: [{ db: 'file', rel: 'modules/reconciler/sla.yaml', at: fs.statSync(SLA_FILE).mtimeMs }, { db: 'file', rel: 'modules/models/runtimes.yaml' }] }; }
  catch { return failure(503, 'SLA_CATALOG_UNAVAILABLE', 'SLA catalog source could not be read'); }
}
function routeServices({ store }) { return { data: services(store.machine), sources: source('machine', 'v_services', 'service_probes', 'service_events') }; }
function routeServiceTarget({ store, url }) {
  return { data: serviceTarget(store, url), sources: source('machine', 'v_services', 'service_probes', 'v_seats', 'v_deaf_seats', 'seat_transcript_snapshots', 'terminals', 'blobs') };
}
function routeServiceProbes({ url, pathname, m }) {
  const name = decodeURIComponent(pathname.split('/')[3]);
  if (!one(m, 'SELECT name FROM services WHERE name=?', name)) return failure(404, 'NOT_FOUND', 'Service not found');
  const from = Number(url.searchParams.get('since')) || 0, limit = limitOf(url);
  return { data: { probes: many(m, 'SELECT * FROM service_probes WHERE name=? AND at>=? ORDER BY at DESC LIMIT ?', name, from, limit).map(row => ({ at: row.at, ok: Boolean(row.ok), latencyMs: row.latency_ms, detail: parse(row.detail_json) })),
    events: many(m, 'SELECT * FROM service_events WHERE name=? AND at>=? ORDER BY at DESC LIMIT ?', name, from, limit).map(row => ({ at: row.at, from: row.from_state, to: row.to_state, probeMs: row.probe_ms, probeError: row.probe_error, action: row.action })) },
  sources: source('machine', 'service_probes', 'service_events') };
}
function routeSeats({ store }) { return { data: seats(store), sources: source('machine', 'v_seats', 'v_deaf_seats', 'seat_transcript_snapshots', 'deliveries', 'seat_turns', 'blobs') }; }
function routeTerminals({ store, url }) { return { data: terminals(store, url), sources: source('machine', 'terminals') }; }
function routeResources({ store, m }) {
  return { data: resources(store), sources: source('machine', 'throttle_state', 'throttle_events', 'throttle_decisions', 'pool_backoff', 'provider_health', 'quotas', 'host_resources', 'host_leases', 'budgets', ...(admissionObserved(m) ? ['provider_reservations'] : [])) };
}
function routeResourceSamples({ url, m }) {
  const kind = url.searchParams.get('kind') ?? 'host', from = Number(url.searchParams.get('since')) || 0, step = Math.max(1, Number(url.searchParams.get('step')) || 1);
  return { data: many(m, 'SELECT * FROM host_samples WHERE kind=? AND at>=? ORDER BY at', kind, from).filter((_row, index) => index % step === 0).map(row => ({ at: row.at, ramMb: row.ram_mb, cpuPct: row.cpu_pct, freeRamMb: row.free_ram_mb, freeRamPct: row.free_ram_pct, freeDiskGb: row.free_disk_gb, subject: row.subject })), sources: source('machine', 'host_samples') };
}
function routeGcRuns({ url, m }) { return pageOf(many(m, 'SELECT * FROM gc_runs ORDER BY run_id DESC').map(row => gcRun(m, row)), url, source('machine', 'gc_runs', 'blobs')); }
function routeGcRun({ pathname, m }) {
  const id = Number(pathname.split('/')[4]);
  const row = one(m, 'SELECT * FROM gc_runs WHERE run_id=?', id);
  if (!row) return failure(404, 'NOT_FOUND', 'GC run not found');
  return { data: { run: gcRun(m, row), items: many(m, 'SELECT * FROM gc_items WHERE run_id=? ORDER BY item_id', id).map(item => ({ collector: item.collector, kind: item.kind, target: relative(item.target), owner: item.owner_ref ? ref('gc', item.owner_ref) : null,
    ageMs: item.age_ms, action: item.action, reason: item.reason, bytes: item.bytes, tries: item.tries,
    outcome: item.outcome, lastError: item.last_error, verifiedGoneAt: item.verified_gone_at, at: item.at })) }, sources: source('machine', 'gc_runs', 'gc_items', 'blobs') };
}
function routeLeaks({ store }) { return { data: leaks(store), sources: [...source('machine', 'v_leaks'), ...projectSources(store, 'v_ledger_leaks')] }; }
function routeLand({ store }) { return { data: land(store), sources: source('machine', 'land_queue', 'land_runs', 'pushes', 'repositories', 'blobs') }; }
function routeLandTarget({ store, url }) { return { data: landTarget(store, url), sources: source('machine', 'land_queue', 'land_runs', 'lanes', 'pushes', 'repositories', 'blobs') }; }
function routeLandRuns({ url, m }) {
  const rows = filterParams(many(m, 'SELECT * FROM land_runs ORDER BY run_id DESC'), url, [['lane', 'lane'], ['result', 'result']]);
  return pageOf(rows.map(row => landRun(m, row)), url, source('machine', 'land_runs', 'blobs'));
}
function routeLanes({ url, m }) {
  return { data: many(m, 'SELECT * FROM lanes ORDER BY created_at DESC').filter(row => !url.searchParams.has('state') || row.state === url.searchParams.get('state')).map(row => laneRow(m, row)), sources: source('machine', 'lanes', 'blobs') };
}
function routeSupervisor({ store }) { return { data: supervisor(store), sources: source('machine', 'v_seats', 'v_open_sup_decisions', 'sup_owed', 'sup_jobs', 'sup_attempts', 'notifications') }; }
const RUNNING_JOB_STATES = ['spawning', 'running', 'reported', 'landing'];
function routeSupervisorWorkers({ url, m }) {
  let rows = many(m, 'SELECT j.*,a.* FROM sup_jobs j LEFT JOIN sup_attempts a ON a.attempt_id=(SELECT max(attempt_id) FROM sup_attempts WHERE job_id=j.job_id) ORDER BY j.created_at DESC');
  if (url.searchParams.get('state') !== 'all') rows = rows.filter(row => RUNNING_JOB_STATES.includes(row.status));
  return pageOf(rows.map(row => ({ job: row.job_id, lane: row.lane, kind: row.kind, title: row.title, status: row.status,
    attempt: row.attempt_id == null ? null : { agent: row.agent, model: row.model, terminal: row.terminal_handle,
      worktree: relative(row.worktree_path), branch: row.branch, spawnedAt: row.spawned_at, reportedAt: row.reported_at,
      landedAt: row.landed_at, verdict: row.verdict, landedSha: row.landed_sha, tokensIn: row.tokens_in,
      tokensOut: row.tokens_out, costUsd: row.cost_usd, transcript: blob(m, row.transcript_sha) },
    ui: uiState(m, 'sup-job', row.status) })), url, source('machine', 'sup_jobs', 'sup_attempts', 'blobs'));
}
function routeSupervisorLessons({ url, m }) {
  const rows = filterParams(many(m, 'SELECT * FROM sup_learning ORDER BY updated_at DESC'), url, [['kind', 'kind'], ['state', 'state']]);
  return pageOf(rows.map(row => ({ id: row.item_id, kind: row.kind, parent: row.parent_id, title: row.title, state: row.state,
    source: row.source_ref ? ref('workflow', row.source_ref) : null, lane: row.lane, landedSha: row.landed_sha,
    createdAt: row.created_at, updatedAt: row.updated_at })), url, source('machine', 'sup_learning'));
}
function routeSupervisorRulings({ url, m }) {
  return { data: many(m, 'SELECT * FROM sup_owner_rulings ORDER BY said_at DESC').filter(row => !url.searchParams.has('q') || `${row.verbatim} ${row.paraphrase}`.toLowerCase().includes(url.searchParams.get('q').toLowerCase())).map(row => ({ id: row.ruling_id, saidAt: row.said_at, channel: row.channel, verbatim: row.verbatim,
    paraphrase: row.paraphrase, appliesTo: row.applies_to, contractRef: row.contract_ref })), sources: source('machine', 'sup_owner_rulings') };
}
function routeNotifications({ url, m }) {
  const rows = many(m, 'SELECT * FROM notifications ORDER BY notif_id DESC').filter(row => !url.searchParams.has('kind') || row.kind === url.searchParams.get('kind'));
  return pageOf(rows.map(row => ({ id: row.notif_id, channel: row.channel, kind: row.kind, text: row.text, sentAt: row.sent_at, delivery: row.delivery, media: blob(m, row.media_sha) })), url, source('machine', 'notifications', 'blobs'));
}

const SYSTEM_ROUTES = new Map([
  ['/api/health', routeHealth], ['/api/reconciler', routeReconciler], ['/api/reconciler/actions', routeReconcilerActions],
  ['/api/reconciler/queue', routeReconcilerQueue], ['/api/sla/violations', routeSlaViolations], ['/api/sla/clocks', routeSlaClocks],
  ['/api/sla/catalog', routeSlaCatalog], ['/api/services', routeServices], ['/api/services/target', routeServiceTarget],
  ['/api/seats', routeSeats], ['/api/terminals', routeTerminals], ['/api/resources', routeResources],
  ['/api/resources/samples', routeResourceSamples], ['/api/gc/runs', routeGcRuns], ['/api/leaks', routeLeaks],
  ['/api/land', routeLand], ['/api/land/target', routeLandTarget], ['/api/land/runs', routeLandRuns], ['/api/lanes', routeLanes],
  ['/api/supervisor', routeSupervisor], ['/api/supervisor/workers', routeSupervisorWorkers],
  ['/api/supervisor/lessons', routeSupervisorLessons], ['/api/supervisor/rulings', routeSupervisorRulings],
  ['/api/notifications', routeNotifications],
]);
const SYSTEM_PATTERN_ROUTES = [[/^\/api\/services\/[^/]+\/probes$/, routeServiceProbes], [/^\/api\/gc\/runs\/\d+$/, routeGcRun]];
const routeOf = pathname => SYSTEM_ROUTES.get(pathname) ?? SYSTEM_PATTERN_ROUTES.find(([pattern]) => pattern.test(pathname))?.[1];

/** C3/C11/C13–C16 machine/system read projections. */
export function handleSystem(request, response, store, url) {
  const pathname = url.pathname;
  if (!/^\/api\/(health|reconciler|sla|services|seats|terminals|resources|gc|leaks|land|lanes|supervisor|notifications)(\/|$)/.test(pathname)) return false;
  if (!store.machine) { sendError(request, response, 503, 'MACHINE_UNAVAILABLE', 'Machine database unavailable'); return true; }
  const route = routeOf(pathname);
  if (!route) return false;
  const result = route({ store, url, pathname, m: store.machine.db });
  if (result.failure) { sendError(request, response, result.failure.status, result.failure.code, result.failure.message); return true; }
  sendJson(request, response, result.data, { sources: result.sources ?? [], stale: staleOf(store), next: result.next ?? null });
  return true;
}
