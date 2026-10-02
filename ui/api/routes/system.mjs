import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../engine/yaml.mjs';
import { sendJson, sendError } from '../envelope.mjs';
import { source, many, one, parse, staleOf, limitOf, page } from '../query.mjs';
import { uiState } from '../state.mjs';
import { reason } from '../reason.mjs';

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
  const href = kind === 'workflow' ? `#/w/${p}/${key}` : kind === 'attempt' ? `#/a/${p}/${key}`
    : kind === 'di' ? `#/decisions?id=${key}` : `#/system/${kind}?id=${key}`;
  return { kind, ...(project ? { project } : {}), id: String(id), href };
}
function blob(machine, sha) {
  if (!sha) return null;
  const row = one(machine, 'SELECT sha256,bytes,media_type,archived_at FROM blobs WHERE sha256=?', sha);
  return row ? { sha: row.sha256, bytes: row.bytes, mediaType: row.media_type, href: `/api/blob/${row.sha256}`, archived: row.archived_at != null } : null;
}
function projectName(store, ledgerId) { return store.projects().find(row => row.ledgerId === ledgerId)?.name ?? null; }
function allLedgers(store, fn) { return store.forEachLedger(({ row, db }) => fn(row, db)).flatMap(entry => entry.error ? [] : entry.result ?? []); }
function health(store) {
  const m = store.machine.db;
  const engine = one(m, 'SELECT ui FROM v_engine_health');
  const badServices = one(m, "SELECT count(*) AS n FROM v_services WHERE ui='bad'")?.n ?? 0;
  const badSeats = one(m, "SELECT count(*) AS n FROM v_seats WHERE ui='bad'")?.n ?? 0;
  const throttle = one(m, 'SELECT mode FROM throttle_state WHERE id=1');
  const slaBad = one(m, "SELECT count(*) AS n FROM v_sla_open WHERE ui='bad'")?.n ?? 0;
  const slaWarn = one(m, "SELECT count(*) AS n FROM v_sla_open WHERE ui='warn'")?.n ?? 0;
  const leaks = (one(m, 'SELECT count(*) AS n FROM v_leaks')?.n ?? 0) + allLedgers(store, (_row, db) => [one(db, 'SELECT count(*) AS n FROM v_ledger_leaks')?.n ?? 0]).reduce((a, b) => a + b, 0);
  const gc = one(m, 'SELECT * FROM gc_runs ORDER BY run_id DESC LIMIT 1');
  const land = one(m, "SELECT count(*) AS n FROM land_queue WHERE state IN ('queued','running')")?.n ?? 0;
  const providers = one(m, "SELECT count(*) AS n FROM provider_health WHERE status='unavailable'")?.n ?? 0;
  const item = (key, ui, value, href, code = null) => ({ key, ui, value: String(value), reason: code ? reason(code, { count: value }) : null, href });
  const items = [
    item('engine', engine?.ui ?? 'unknown', engine?.ui ?? 'unknown', '#/system/engine', engine?.ui === 'bad' ? 'ENGINE_BAD' : null),
    item('services', badServices ? 'bad' : 'ok', badServices, '#/system/services', badServices ? 'SERVICE_DOWN' : null),
    item('seats', badSeats ? 'bad' : 'ok', badSeats, '#/system/services', badSeats ? 'SEAT_BAD' : null),
    item('ram', throttle?.mode === 'critical' ? 'bad' : throttle?.mode === 'heavy' ? 'warn' : 'ok', throttle?.mode ?? 'unknown', '#/system/resources', throttle?.mode === 'critical' ? 'RAM_CRITICAL' : null),
    item('sla', slaBad ? 'bad' : slaWarn ? 'warn' : 'ok', slaBad + slaWarn, '#/system/sla', slaBad ? 'SLA_CRITICAL' : slaWarn ? 'SLA_WARNING' : null),
    item('leaks', leaks ? 'warn' : 'ok', leaks, '#/system/cleanup', leaks ? 'LEAKS_OPEN' : null),
    item('gc', gc && parse(gc.errors_json, []).length ? 'warn' : 'ok', gc?.run_id ?? 0, '#/system/cleanup'),
    item('land', land ? 'waiting' : 'ok', land, '#/system/land'),
    item('providers', providers ? 'bad' : 'ok', providers, '#/system/resources', providers ? 'PROVIDER_UNAVAILABLE' : null),
  ];
  return { ui: items.some(x => x.ui === 'bad') ? 'bad' : items.some(x => x.ui === 'warn') ? 'warn' : 'ok', items };
}
function action(machine, row, store) {
  const project = projectName(store, row.ledger_id);
  return { id: row.id, controller: row.controller, duty: row.duty, key: row.key, verb: row.verb,
    state: row.state, ui: row.ui, mode: row.mode, epoch: row.epoch,
    startedAt: row.started_at, finishedAt: row.finished_at, exitCode: row.exit_code,
    errorSignature: row.error_signature,
    target: row.attempt_id ? ref('attempt', row.attempt_id, project) : row.workflow_id ? ref('workflow', row.workflow_id, project) : null,
    result: parse(row.result_json), resultBlob: blob(machine, row.result_sha), stdout: blob(machine, row.stdout_sha), stderr: blob(machine, row.stderr_sha),
    steps: many(machine, 'SELECT * FROM action_steps WHERE action_id=? ORDER BY step_no', row.id).map(step => ({ stepNo: step.step_no,
      step: step.step, startedAt: step.started_at, ms: step.ms, ok: step.ok == null ? null : Boolean(step.ok) })) };
}
function reconciler(store) {
  const m = store.machine.db, now = Date.now();
  const engine = one(m, 'SELECT * FROM v_engine_health');
  const leader = one(m, 'SELECT expires_at FROM engine_leader LIMIT 1');
  const starts = many(m, 'SELECT at,reason,ended_at,exit_reason,killed_by FROM v_engine_starts WHERE at>=? ORDER BY at DESC', now - DAY);
  const controllers = many(m, 'SELECT * FROM controller_modes ORDER BY controller').map(mode => {
    const queue = one(m, 'SELECT count(*) AS depth,sum(last_error IS NOT NULL) AS failing,min(due_at) AS next_due_at FROM engine_queue WHERE controller=?', mode.controller);
    const acts = many(m, 'SELECT state,count(*) AS n FROM v_engine_actions WHERE controller=? AND started_at>=? GROUP BY state', mode.controller, now - DAY);
    const counts = Object.fromEntries(acts.map(x => [x.state, x.n]));
    const last = one(m, 'SELECT started_at,error_signature,state FROM v_engine_actions WHERE controller=? ORDER BY started_at DESC LIMIT 1', mode.controller);
    return { name: mode.controller, mode: mode.mode, modeSetAt: mode.set_at, modeSetBy: mode.set_by,
      queue: { depth: queue?.depth ?? 0, failing: queue?.failing ?? 0, nextDueAt: queue?.next_due_at ?? null },
      actions24h: Object.fromEntries(['intent', 'running', 'done', 'failed', 'unknown', 'fenced'].map(state => [state, counts[state] ?? 0])),
      lastActionAt: last?.started_at ?? null,
      lastError: last && ['failed', 'unknown'].includes(last.state) ? { at: last.started_at, text: last.error_signature ?? 'Action failed' } : null,
      ui: mode.mode === 'shadow' || mode.mode === 'off' ? 'waiting' : last?.state === 'failed' ? 'bad' : 'ok' };
  });
  const schedules = many(m, 'SELECT * FROM v_schedules ORDER BY controller,duty').map(row => ({ controller: row.controller, duty: row.duty,
    intervalMs: row.interval_ms, lastStartedAt: row.last_started_at, lastResult: row.last_result,
    nextDueAt: row.next_due_at, runs24h: row.runs_24h, ui: row.ui }));
  return { leader: engine ? { holder: engine.holder, epoch: engine.epoch, heartbeatAt: engine.heartbeat_at,
    heartbeatAgeMs: engine.heartbeat_age_ms, expiresAt: leader?.expires_at ?? 0, rev: engine.rev, draining: Boolean(engine.draining),
    passes: engine.passes, lastPassMs: engine.last_pass_ms, lastError: engine.last_error, ui: engine.ui } : null,
    starts24h: starts.map(row => ({ at: row.at, reason: row.reason, endedAt: row.ended_at, exitReason: row.exit_reason, killedBy: row.killed_by })),
    crashLoop: starts.filter(row => row.at >= now - 600000).length > 3,
    startsLastHour: engine?.starts_last_hour ?? 0, badExits24h: engine?.bad_exits_24h ?? 0,
    queueDepth: engine?.queue_depth ?? 0, openViolations: engine?.open_violations ?? 0, controllers, schedules };
}
function services(machine) { return many(machine, 'SELECT * FROM v_services ORDER BY name').map(row => {
  const probe = one(machine, 'SELECT * FROM service_probes WHERE name=? ORDER BY at DESC,probe_id DESC LIMIT 1', row.name);
  return { name: row.name, kind: row.kind, state: row.state, ui: row.ui, since: row.since,
    restarts24h: row.restarts_24h, failedProbes24h: row.failed_probes_24h,
    lastProbe: probe ? { at: probe.at, ok: Boolean(probe.ok), latencyMs: probe.latency_ms, detail: parse(probe.detail_json) } : null,
    port: row.port, url: row.url, quarantinedUntil: row.quarantined_until };
}); }
function seats(store) { const m = store.machine.db; const deaf = new Set(many(m, 'SELECT seat_id FROM v_deaf_seats').map(x => x.seat_id));
  return many(m, 'SELECT * FROM v_seats ORDER BY role,seat_id').map(row => {
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
function resources(machine) {
  const state = one(machine, 'SELECT * FROM throttle_state WHERE id=1');
  const recent = many(machine, 'SELECT at,from_mode,to_mode,reason FROM throttle_events ORDER BY seq DESC LIMIT 20').map(row => ({ at: row.at, from: row.from_mode, to: row.to_mode, reason: row.reason }));
  const pools = many(machine, 'SELECT * FROM pool_backoff').map(row => ({ pool: row.pool, untilAt: row.until_at, strikes: row.strikes, reason: row.reason,
    ui: row.until_at && row.until_at > Date.now() ? 'warn' : 'ok' }));
  const providers = many(machine, 'SELECT * FROM provider_health').map(row => ({ provider: row.provider, status: row.status,
    failureKind: row.failure_kind, strikes: row.strikes, circuitOpenUntil: row.circuit_open_until, reason: row.reason,
    ui: uiState(machine, 'provider', row.status) }));
  const quotas = many(machine, 'SELECT * FROM quotas').map(row => ({ provider: row.provider, window: row.window,
    used: row.used, limit: row.limit_value, resetAt: row.reset_at, observedAt: row.observed_at,
    ui: row.limit_value != null && row.used >= row.limit_value ? 'warn' : 'ok' }));
  const leases = many(machine, 'SELECT * FROM host_resources').map(row => { const holders = many(machine, 'SELECT * FROM host_leases WHERE resource_key=?', row.resource_key);
    return { resource: row.resource_key, capacity: row.capacity, used: holders.reduce((n, x) => n + x.units, 0),
      holders: holders.map(x => ref('workflow', x.workflow_id)) }; });
  const budgets = many(machine, 'SELECT * FROM budgets').map(row => ({ scope: row.scope_key, limit: row.limit_value,
    used: row.used_value, reserved: row.reserved_value, window: row.window,
    ui: row.used_value + row.reserved_value >= row.limit_value ? 'warn' : 'ok' }));
  const deferred = many(machine, 'SELECT * FROM throttle_decisions ORDER BY seq DESC LIMIT 100').map(row => ({ at: row.at,
    project: null, wf: row.workflow_id, job: row.job_id, reason: row.reason, waitedMs: row.waited_ms, releasedAt: row.released_at }));
  return { throttle: { mode: state?.mode ?? 'normal', effectiveCap: state?.effective_cap ?? null, running: state?.running ?? null,
    freeRamPct: state?.free_ram_pct ?? null, cpuPct: state?.cpu_pct ?? null, since: state?.since ?? null,
    reason: state?.reason ?? null, priorities: parse(state?.priorities_json),
    ui: uiState(machine, 'throttle', state?.mode ?? 'normal'), recent }, pools, providers, quotas, leases, budgets, deferred };
}
function gcRun(machine, row) { return { id: row.run_id, startedAt: row.started_at, finishedAt: row.finished_at,
  trigger: row.trigger, freedBytes: row.freed_bytes, counts: parse(row.counts_json, {}), errors: parse(row.errors_json, []).length,
  report: blob(machine, row.report_sha), ui: row.finished_at ? parse(row.errors_json, []).length ? 'warn' : 'done' : 'running' }; }
function leaks(store) {
  const machine = store.machine.db;
  const rows = many(machine, 'SELECT * FROM v_leaks').map(item => ({ kind: item.kind, target: relative(item.target),
    project: projectName(store, item.ledger_id), since: item.since, owner: item.owner ? ref('workflow', item.owner, projectName(store, item.ledger_id)) : null }));
  rows.push(...allLedgers(store, (ledger, db) => many(db, 'SELECT * FROM v_ledger_leaks').map(item => ({ kind: item.kind,
    target: relative(item.target), project: ledger.name, since: item.due_at,
    owner: item.workflow_id ? ref('workflow', item.workflow_id, ledger.name) : null }))));
  return rows.sort((a, b) => a.since - b.since);
}
function landRun(machine, row) { return { id: row.run_id, ticket: row.ticket_id, lane: row.lane, commit: row.commit_sha,
  landedSha: row.landed_sha, result: row.result, ui: uiState(machine, 'land', row.result), reason: row.reason,
  specs: parse(row.specs_json), push: row.push_id ? ref('land', row.push_id) : null,
  stdout: blob(machine, row.stdout_sha), stderr: blob(machine, row.stderr_sha),
  startedAt: row.started_at, finishedAt: row.finished_at }; }
function land(store) { const m = store.machine.db; return {
  queue: many(m, 'SELECT * FROM land_queue ORDER BY enqueued_at DESC LIMIT 100').map(row => ({ ticket: row.ticket_id,
    lane: row.lane, commit: row.commit_sha, state: row.state, enqueuedAt: row.enqueued_at,
    gateAt: row.gate_at, busyHolder: row.busy_holder, startedAt: row.started_at, ui: uiState(m, 'land', row.state) })),
  recent: many(m, 'SELECT * FROM land_runs ORDER BY run_id DESC LIMIT 20').map(row => landRun(m, row)),
  pushes: many(m, 'SELECT * FROM pushes ORDER BY push_id DESC LIMIT 20').map(row => ({ repo: one(m, 'SELECT name FROM repositories WHERE repo_root=?', row.repo_root)?.name ?? relative(row.repo_root),
    branch: row.branch, head: row.head, from: row.from_sha, to: row.to_sha, result: row.result, reason: row.reason,
    failureSignature: row.failure_signature, stdout: blob(m, row.stdout_sha), stderr: blob(m, row.stderr_sha),
    at: row.at, ui: uiState(m, 'push', row.result) })) };
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
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../modules/reconciler/sla.yaml');
  const runtimesFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../modules/models/runtimes.yaml');
  try { const codes = parseYaml(fs.readFileSync(file, 'utf8')).codes ?? {};
    const allocation = parseYaml(fs.readFileSync(runtimesFile, 'utf8')).allocation;
    return Object.entries(codes).map(([code, value]) => ({ code, state: code,
      slaMs: (value.slaKey?.split('.').reduce((entry, key) => entry?.[key], allocation) ?? value.slaMs ?? null) == null ? null
        : (value.slaKey?.split('.').reduce((entry, key) => entry?.[key], allocation) ?? value.slaMs) + (value.plusMs ?? 0),
      warnMs: value.warnMs ?? null, severity: value.severity, owner: value.owner, autoAction: value.autoAction })); }
  catch { return []; }
}
const SLA_CATALOG = catalog();

/** C3/C11/C13–C16 machine/system read projections. */
export function handleSystem(request, response, store, url) {
  const pathname = url.pathname;
  if (!/^\/api\/(health|reconciler|sla|services|seats|terminals|resources|gc|leaks|land|lanes|supervisor|notifications)(\/|$)/.test(pathname)) return false;
  if (!store.machine) { sendError(request, response, 503, 'MACHINE_UNAVAILABLE', 'Machine database unavailable'); return true; }
  const m = store.machine.db;
  let data, sources = [], next = null;
  if (pathname === '/api/health') { data = health(store); sources = [...source('machine', 'v_engine_health', 'v_services', 'v_seats', 'v_deaf_seats', 'throttle_state', 'provider_health', 'v_sla_open', 'invariant_violations', 'v_leaks', 'gc_runs', 'land_queue'), ...store.projects().flatMap(row => source(row.name, 'v_ledger_leaks'))]; }
  else if (pathname === '/api/reconciler') { data = reconciler(store); sources = source('machine', 'v_engine_health', 'engine_leader', 'leader_history', 'v_engine_starts', 'process_runs', 'controller_modes', 'mode_changes', 'engine_queue', 'v_engine_actions', 'v_schedules'); }
  else if (pathname === '/api/reconciler/actions') {
    let rows = many(m, 'SELECT * FROM v_engine_actions ORDER BY started_at DESC LIMIT 1000');
    for (const [param, field] of [['controller', 'controller'], ['state', 'state'], ['wf', 'workflow_id'], ['job', 'job_id']]) if (url.searchParams.has(param)) rows = rows.filter(row => row[field] === url.searchParams.get(param));
    if (url.searchParams.has('project')) rows = rows.filter(row => projectName(store, row.ledger_id) === url.searchParams.get('project'));
    if (url.searchParams.has('since')) rows = rows.filter(row => row.started_at >= Number(url.searchParams.get('since')));
    const result = page(rows.map(row => action(m, row, store)), url); data = result.rows; next = result.next; sources = source('machine', 'v_engine_actions', 'action_steps', 'blobs');
  }
  else if (pathname === '/api/reconciler/queue') { data = many(m, 'SELECT * FROM engine_queue ORDER BY due_at').filter(row => !url.searchParams.has('controller') || row.controller === url.searchParams.get('controller')).map(row => ({ controller: row.controller, key: row.key, dueAt: row.due_at, reason: row.reason, tries: row.tries, lastError: row.last_error })); sources = source('machine', 'engine_queue'); }
  else if (pathname === '/api/sla/violations') {
    let rows = many(m, 'SELECT * FROM invariant_violations ORDER BY violated_at DESC');
    if (url.searchParams.get('open') === '1') rows = rows.filter(row => row.cleared_at == null);
    if (url.searchParams.has('code')) rows = rows.filter(row => row.code === url.searchParams.get('code'));
    if (url.searchParams.has('project')) rows = rows.filter(row => projectName(store, row.ledger_id) === url.searchParams.get('project'));
    if (url.searchParams.has('since')) rows = rows.filter(row => row.violated_at >= Number(url.searchParams.get('since')));
    const result = page(rows.map(row => ({ id: row.violation_id, code: row.code, severity: row.severity,
      entity: { text: row.entity }, project: projectName(store, row.ledger_id), violatedAt: row.violated_at,
      clearedAt: row.cleared_at, di: row.di_id ? ref('di', row.di_id) : null,
      lesson: row.lesson_id ? ref('lesson', row.lesson_id) : null, detail: parse(row.detail_json) })), url);
    data = result.rows; next = result.next; sources = source('machine', 'invariant_violations', 'sla_episodes');
  }
  else if (pathname === '/api/sla/clocks') {
    const open = url.searchParams.get('open') !== '0';
    let rows = many(m, `SELECT * FROM ${open ? 'v_sla_open' : 'sla_episodes'} ORDER BY entered_at DESC LIMIT 1000`);
    for (const [param, field] of [['state', 'state'], ['code', 'code']]) if (url.searchParams.has(param)) rows = rows.filter(row => row[field] === url.searchParams.get(param));
    if (url.searchParams.get('violated') === '1') rows = rows.filter(row => row.violated_at != null);
    if (url.searchParams.has('project')) rows = rows.filter(row => projectName(store, row.ledger_id) === url.searchParams.get('project'));
    data = rows.map(row => ({ id: row.episode_id, entity: row.entity, state: row.state, code: row.code,
      severity: row.severity, project: projectName(store, row.ledger_id), wf: row.workflow_id,
      enteredAt: row.entered_at, slaMs: row.sla_ms, dueAt: row.due_at ?? row.entered_at + row.sla_ms,
      violatedAt: row.violated_at, clearedAt: row.cleared_at, clearReason: row.clear_reason,
      di: row.di_id ? ref('di', row.di_id) : null,
      ui: row.ui ?? (row.cleared_at ? 'done' : row.violated_at ? row.severity === 'critical' ? 'bad' : 'warn' : 'waiting') }));
    sources = source('machine', open ? 'v_sla_open' : 'sla_episodes');
  }
  else if (pathname === '/api/sla/catalog') { data = SLA_CATALOG; sources = [{ db: 'machine', rel: 'modules/reconciler/sla.yaml' }]; }
  else if (pathname === '/api/services') { data = services(m); sources = source('machine', 'v_services', 'service_probes', 'service_events'); }
  else if (/^\/api\/services\/[^/]+\/probes$/.test(pathname)) {
    const name = decodeURIComponent(pathname.split('/')[3]);
    if (!one(m, 'SELECT name FROM services WHERE name=?', name)) { sendError(request, response, 404, 'NOT_FOUND', 'Service not found'); return true; }
    const since = Number(url.searchParams.get('since')) || 0, limit = limitOf(url);
    data = { probes: many(m, 'SELECT * FROM service_probes WHERE name=? AND at>=? ORDER BY at DESC LIMIT ?', name, since, limit).map(row => ({ at: row.at, ok: Boolean(row.ok), latencyMs: row.latency_ms, detail: parse(row.detail_json) })),
      events: many(m, 'SELECT * FROM service_events WHERE name=? AND at>=? ORDER BY at DESC LIMIT ?', name, since, limit).map(row => ({ at: row.at, from: row.from_state, to: row.to_state, probeMs: row.probe_ms, probeError: row.probe_error, action: row.action })) }; sources = source('machine', 'service_probes', 'service_events');
  }
  else if (pathname === '/api/seats') { data = seats(store); sources = source('machine', 'v_seats', 'v_deaf_seats', 'seat_transcript_snapshots', 'deliveries', 'seat_turns', 'blobs'); }
  else if (pathname === '/api/terminals') { data = terminals(store, url); sources = source('machine', 'terminals'); }
  else if (pathname === '/api/resources') { data = resources(m); sources = source('machine', 'throttle_state', 'throttle_events', 'throttle_decisions', 'pool_backoff', 'provider_health', 'quotas', 'host_resources', 'host_leases', 'budgets'); }
  else if (pathname === '/api/resources/samples') { const kind = url.searchParams.get('kind') ?? 'host', since = Number(url.searchParams.get('since')) || 0, step = Math.max(1, Number(url.searchParams.get('step')) || 1);
    data = many(m, 'SELECT * FROM host_samples WHERE kind=? AND at>=? ORDER BY at', kind, since).filter((_row, index) => index % step === 0).map(row => ({ at: row.at, ramMb: row.ram_mb, cpuPct: row.cpu_pct, freeRamMb: row.free_ram_mb, freeRamPct: row.free_ram_pct, freeDiskGb: row.free_disk_gb, subject: row.subject })); sources = source('machine', 'host_samples'); }
  else if (pathname === '/api/gc/runs') { const result = page(many(m, 'SELECT * FROM gc_runs ORDER BY run_id DESC').map(row => gcRun(m, row)), url); data = result.rows; next = result.next; sources = source('machine', 'gc_runs', 'blobs'); }
  else if (/^\/api\/gc\/runs\/\d+$/.test(pathname)) { const id = Number(pathname.split('/')[4]); const row = one(m, 'SELECT * FROM gc_runs WHERE run_id=?', id); if (!row) { sendError(request, response, 404, 'NOT_FOUND', 'GC run not found'); return true; }
    data = { run: gcRun(m, row), items: many(m, 'SELECT * FROM gc_items WHERE run_id=? ORDER BY item_id', id).map(item => ({ collector: item.collector, kind: item.kind, target: relative(item.target), owner: item.owner_ref ? ref('gc', item.owner_ref) : null,
      ageMs: item.age_ms, action: item.action, reason: item.reason, bytes: item.bytes, tries: item.tries,
      outcome: item.outcome, lastError: item.last_error, verifiedGoneAt: item.verified_gone_at, at: item.at })) }; sources = source('machine', 'gc_runs', 'gc_items', 'blobs'); }
  else if (pathname === '/api/leaks') { data = leaks(store); sources = [...source('machine', 'v_leaks'), ...store.projects().flatMap(row => source(row.name, 'v_ledger_leaks'))]; }
  else if (pathname === '/api/land') { data = land(store); sources = source('machine', 'land_queue', 'land_runs', 'pushes', 'repositories', 'blobs'); }
  else if (pathname === '/api/land/runs') { let rows = many(m, 'SELECT * FROM land_runs ORDER BY run_id DESC'); if (url.searchParams.has('lane')) rows = rows.filter(row => row.lane === url.searchParams.get('lane')); if (url.searchParams.has('result')) rows = rows.filter(row => row.result === url.searchParams.get('result')); const result = page(rows.map(row => landRun(m, row)), url); data = result.rows; next = result.next; sources = source('machine', 'land_runs', 'blobs'); }
  else if (pathname === '/api/lanes') { data = many(m, 'SELECT * FROM lanes ORDER BY created_at DESC').filter(row => !url.searchParams.has('state') || row.state === url.searchParams.get('state')).map(row => ({ name: row.name, worktree: relative(row.worktree_path), branch: row.branch,
    baseSha: row.base_sha, headSha: row.head_sha, owner: row.owner, supJob: row.sup_job_id ? ref('workflow', row.sup_job_id) : null,
    state: row.state, ui: uiState(m, 'lane', row.state), createdAt: row.created_at, landedAt: row.landed_at, removedAt: row.removed_at, report: blob(m, row.report_sha) })); sources = source('machine', 'lanes', 'blobs'); }
  else if (pathname === '/api/supervisor') { data = supervisor(store); sources = source('machine', 'v_seats', 'v_open_sup_decisions', 'sup_owed', 'sup_jobs', 'sup_attempts', 'notifications'); }
  else if (pathname === '/api/supervisor/workers') { let rows = many(m, 'SELECT j.*,a.* FROM sup_jobs j LEFT JOIN sup_attempts a ON a.attempt_id=(SELECT max(attempt_id) FROM sup_attempts WHERE job_id=j.job_id) ORDER BY j.created_at DESC');
    if (url.searchParams.get('state') !== 'all') rows = rows.filter(row => ['spawning', 'running', 'reported', 'landing'].includes(row.status));
    const result = page(rows.map(row => ({ job: row.job_id, lane: row.lane, kind: row.kind, title: row.title, status: row.status,
      attempt: row.attempt_id == null ? null : { agent: row.agent, model: row.model, terminal: row.terminal_handle,
        worktree: relative(row.worktree_path), branch: row.branch, spawnedAt: row.spawned_at, reportedAt: row.reported_at,
        landedAt: row.landed_at, verdict: row.verdict, landedSha: row.landed_sha, tokensIn: row.tokens_in,
        tokensOut: row.tokens_out, costUsd: row.cost_usd, transcript: blob(m, row.transcript_sha) },
      ui: uiState(m, 'sup-job', row.status) })), url); data = result.rows; next = result.next; sources = source('machine', 'sup_jobs', 'sup_attempts', 'blobs'); }
  else if (pathname === '/api/supervisor/lessons') { let rows = many(m, 'SELECT * FROM sup_learning ORDER BY updated_at DESC'); if (url.searchParams.has('kind')) rows = rows.filter(row => row.kind === url.searchParams.get('kind')); if (url.searchParams.has('state')) rows = rows.filter(row => row.state === url.searchParams.get('state')); const result = page(rows.map(row => ({ id: row.item_id, kind: row.kind, parent: row.parent_id, title: row.title, state: row.state,
    source: row.source_ref ? ref('workflow', row.source_ref) : null, lane: row.lane, landedSha: row.landed_sha,
    createdAt: row.created_at, updatedAt: row.updated_at })), url); data = result.rows; next = result.next; sources = source('machine', 'sup_learning'); }
  else if (pathname === '/api/supervisor/rulings') { data = many(m, 'SELECT * FROM sup_owner_rulings ORDER BY said_at DESC').filter(row => !url.searchParams.has('q') || `${row.verbatim} ${row.paraphrase}`.toLowerCase().includes(url.searchParams.get('q').toLowerCase())).map(row => ({ id: row.ruling_id, saidAt: row.said_at, channel: row.channel, verbatim: row.verbatim,
    paraphrase: row.paraphrase, appliesTo: row.applies_to, contractRef: row.contract_ref })); sources = source('machine', 'sup_owner_rulings'); }
  else if (pathname === '/api/notifications') { const rows = many(m, 'SELECT * FROM notifications ORDER BY notif_id DESC').filter(row => !url.searchParams.has('kind') || row.kind === url.searchParams.get('kind')); const result = page(rows.map(row => ({ id: row.notif_id, channel: row.channel, kind: row.kind, text: row.text, sentAt: row.sent_at, delivery: row.delivery, media: blob(m, row.media_sha) })), url); data = result.rows; next = result.next; sources = source('machine', 'notifications', 'blobs'); }
  else return false;
  sendJson(request, response, data, { sources, stale: staleOf(store), next });
  return true;
}
