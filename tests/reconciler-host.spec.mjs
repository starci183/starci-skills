import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHostController, findOrphans, seatStateOf, goalProblem, outputOf, NEEDS_REPAIR } from '../scripts/reconciler/controllers/host.mjs';
import { hostSettings, memoryStore } from '../scripts/reconciler/services.mjs';
import { goalTextRefusal } from '../scripts/goal/goal-text.mjs';

// Lane D rc-host: the Host controller over a fake ctx (the shared contract of LANES.md: mode, now, ledgers, read,
// run, api, clock, clear, openDecision, log). ctx.run and ctx.api only record, as shadow does; an active spec
// answers them with a canned child output. Nothing here touches Orca, a process or a real ledger.

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');
const S = hostSettings();
const T0 = Date.UTC(2026, 8, 28, 1, 0, 0);
const GOAL = '# Goal\nShip the canon refactor.';

function ledgerDb({ workflows = [], jobs = [] } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE workflows(workflow_id TEXT PRIMARY KEY, phase TEXT, archived_at INTEGER);
    CREATE TABLE goals(goal_seq INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT, revision INTEGER, markdown TEXT);
    CREATE TABLE jobs(job_id TEXT PRIMARY KEY, status TEXT, worker_id TEXT);`);
  for (const w of workflows) {
    db.prepare('INSERT INTO workflows VALUES(?,?,?)').run(w.id, w.phase ?? 'running', w.archivedAt ?? null);
    if (w.goal !== undefined) db.prepare('INSERT INTO goals(workflow_id,revision,markdown) VALUES(?,?,?)').run(w.id, 1, w.goal);
  }
  for (const j of jobs) db.prepare('INSERT INTO jobs VALUES(?,?,?)').run(j.id, j.status, j.worker ?? null);
  return db;
}

function fakeCtx({ mode = 'shadow', now = T0, ledgers, dbs, runAnswer = null } = {}) {
  const calls = { run: [], api: [], clock: [], clear: [], decisions: [], log: [] };
  let t = now;
  const ctx = {
    mode, calls,
    now: () => t, advance: (ms) => { t += ms; },
    ledgers: ledgers ?? [{ ledgerId: 'nivo-backend', repo: 'D:/Repositories/nivo-backend', file: 'D:/Repositories/nivo-backend/.starciwork/runtime.sqlite' }],
    read: (id, fn) => fn(dbs[id]),
    run: async (cmd, args, o) => { calls.run.push({ cmd, args, o }); return mode === 'shadow' ? { ok: true, shadow: true } : (runAnswer?.(cmd, args) ?? { ok: true, stdout: '{}' }); },
    api: async (id, verb, argv) => { calls.api.push({ id, verb, argv }); return { ok: true, shadow: mode === 'shadow' }; },
    clock: (entity, state, slaMs, meta) => { calls.clock.push({ entity, state, slaMs, ...meta }); },
    clear: (entity, state) => { calls.clear.push({ entity, state }); },
    openDecision: async (di) => { calls.decisions.push(di); return { ok: true }; },
    log: (kind, msg, data) => { calls.log.push({ kind, msg, data }); },
    owns: () => false,
  };
  return ctx;
}

const noopRegistry = (healthy = true) => ['orca', 'harness-ui', 'harness-tunnel', 'ask-gateway', 'ask-tunnel', 'telegram-bridge'].map((name) => ({
  name, kind: 'service', restart: true, ownerPath: name !== 'orca', ...S.services[name], probe: async () => ({ ok: typeof healthy === 'function' ? healthy(name) : healthy, terminals: 3 }),
  start: () => ({ cmd: 'node', args: ['scripts/reconciler/services.mjs', '--start', name, '--json'] }),
}));

function controller(over = {}) {
  return createHostController({
    settings: () => S, registry: () => noopRegistry(), store: () => memoryStore(),
    probeSeat: async () => ({ ok: true, action: 'active' }),
    listProcesses: async () => [], hostVerdict: async () => ({ stop: [], alert: false }), orcaTerminals: async () => null,
    supervisorMode: async () => 'kernel', quickCheck: () => ({ ok: true, result: ['ok'] }), backupDue: () => false,
    dedupeDryRun: async () => ({ ok: true, closed: [] }),
    ...over,
  });
}
const booted = (c) => { c._state.bootPending = false; return c; };
const SEAT = 'seat:kernel:nivo-backend:wf-nivo-fe-canon';
const repairRuns = (ctx) => ctx.calls.run.filter((r) => r.args[0] === 'scripts/kernel/watchdog.mjs');

test('pure helpers: seat states, goal problems, child output', () => {
  assert.equal(seatStateOf('restart-needed'), 'suspect');
  assert.equal(seatStateOf('restarted'), 'reserving');
  assert.equal(seatStateOf('host-unavailable'), 'hostOutage');
  assert.equal(seatStateOf('interactive-gate'), 'gated');
  assert.equal(seatStateOf('active'), 'live');
  assert.equal(goalProblem(null, goalTextRefusal), 'goal-text-missing');
  assert.equal(goalProblem('Khởi động lại\nGoal gốc:\n\nnull', goalTextRefusal), 'goal-text-unresolved');
  assert.equal(goalProblem(GOAL, goalTextRefusal), null);
  assert.equal(outputOf({ ok: true, shadow: true }), null);
  assert.deepEqual(outputOf({ stdout: 'noise\n{"action":"restarted"}\n' }), { action: 'restarted' });
  assert.ok(NEEDS_REPAIR.has('restart-needed') && !NEEDS_REPAIR.has('active'));
});

test('shadow: probe action=restart-needed -> the --repair replace is recorded, never run', async () => {
  const dbs = { 'nivo-backend': ledgerDb({ workflows: [{ id: 'wf-nivo-fe-canon', goal: GOAL }] }) };
  const store = memoryStore();
  const c = booted(controller({ store: () => store, probeSeat: async () => ({ ok: true, action: 'restart-needed' }) }));
  const ctx = fakeCtx({ dbs });
  const r = await c.reconcile(SEAT, ctx);
  assert.equal(r.action, 'restart-needed');
  assert.equal(r.replaced, true);
  const runs = repairRuns(ctx);
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0].args, ['scripts/kernel/watchdog.mjs', '--repo', 'D:/Repositories/nivo-backend', '--workflow', 'wf-nivo-fe-canon', '--once', '--repair', '--json']);
  assert.equal(store.get(SEAT).restarts.length, 1);
  assert.equal(store.get(SEAT).state, 'suspect');
  assert.ok(ctx.calls.clock.some((c) => c.entity === SEAT && c.code === 'SEAT_VACANT'));
});

test('shadow: a live Kernel records no repair at all', async () => {
  const dbs = { 'nivo-backend': ledgerDb({ workflows: [{ id: 'wf-nivo-fe-canon', goal: GOAL }] }) };
  const c = booted(controller({ probeSeat: async () => ({ ok: true, action: 'active' }) }));
  const ctx = fakeCtx({ dbs });
  const r = await c.reconcile(SEAT, ctx);
  assert.equal(r.seat, 'live');
  assert.equal(ctx.calls.run.length, 0);
});

test('active: watchdog --once --repair runs through ctx.run and its action=restarted counts a replacement; the 4th in an hour quarantines', async () => {
  const dbs = { 'nivo-backend': ledgerDb({ workflows: [{ id: 'wf-nivo-fe-canon', goal: GOAL }] }) };
  const store = memoryStore();
  const c = booted(controller({ store: () => store, probeSeat: async () => assert.fail('active mode does not probe first') }));
  const ctx = fakeCtx({ dbs, mode: 'active', runAnswer: () => ({ ok: true, stdout: '{"ok":true,"action":"restarted"}' }) });
  for (let i = 0; i < 3; i += 1) { const r = await c.reconcile(SEAT, ctx); assert.equal(r.replaced, true); ctx.advance(60_000); }
  assert.equal(ctx.calls.decisions.length, 0);
  const r4 = await c.reconcile(SEAT, ctx);
  assert.equal(r4.seat, 'quarantined');
  assert.equal(ctx.calls.decisions.length, 1);
  assert.equal(ctx.calls.decisions[0].kind, 'seat-unrecoverable');
  assert.equal(ctx.calls.decisions[0].decider, 'supervisor');
  ctx.advance(60_000);
  const before = repairRuns(ctx).length;
  const held = await c.reconcile(SEAT, ctx);
  assert.equal(held.quarantined, true);
  assert.equal(repairRuns(ctx).length, before, 'a quarantined seat is left alone');
});

test('null goal -> no seat, one DI goal-text-missing for the Supervisor', async () => {
  const dbs = { 'nivo-backend': ledgerDb({ workflows: [{ id: 'wf-nivo-fe-canon', goal: 'Khởi động lại trên runtime mới\nGoal gốc:\n\nnull' }] }) };
  let probed = 0;
  const c = booted(controller({ probeSeat: async () => { probed += 1; return { action: 'restart-needed' }; } }));
  for (const mode of ['shadow', 'active']) {
    const ctx = fakeCtx({ dbs, mode });
    const r1 = await c.reconcile(SEAT, ctx);
    await c.reconcile(SEAT, ctx);
    assert.equal(r1.refused, 'goal-text-unresolved');
    assert.equal(ctx.calls.run.length, 0, `${mode}: no seat is started`);
    assert.equal(new Set(ctx.calls.decisions.map((d) => d.idempotencyKey)).size, 1, `${mode}: one DI`);
    assert.equal(ctx.calls.decisions[0].kind, 'goal-text-missing');
    assert.equal(ctx.calls.decisions[0].decider, 'supervisor');
  }
  assert.equal(probed, 0);
  const missing = { 'nivo-backend': ledgerDb({ workflows: [{ id: 'wf-nivo-fe-canon' }] }) };
  const ctx = fakeCtx({ dbs: missing });
  assert.equal((await booted(controller()).reconcile(SEAT, ctx)).refused, 'goal-text-missing', 'no goal row at all is refused too');
});

test('an orphan watchdog of a temp repo -> stop planned + ORPHAN_PROCESS clock; a listed repo -> never', async () => {
  const old = T0 - 45 * 60_000;
  const procs = [
    { pid: 101, created: old, cmd: '"C:\\Program Files\\nodejs\\node.exe" D:\\Repositories\\starci-academy-backend\\.claude\\scripts\\kernel\\watchdog.mjs --repo C:\\Users\\Hi\\AppData\\Local\\Temp\\starci-host-outage-Ab12\\repo --workflow wf-test-outage --repair' },
    { pid: 102, created: old, cmd: 'node D:\\Repositories\\starci-academy-backend\\.claude\\scripts\\kernel\\watchdog.mjs --repo D:\\Repositories\\nivo-backend --workflow wf-nivo-fe-canon --repair' },
    { pid: 103, created: old, cmd: 'node D:/Repositories/starci-academy-backend/.claude/scripts/supervisor/watchdog.mjs' },
    { pid: 104, created: T0 - 5 * 60_000, cmd: 'node scripts/kernel/serve-ask.mjs --repo C:/Users/Hi/AppData/Local/Temp/starci-x/repo --workflow wf-y' },
    { pid: 105, created: old, cmd: 'node scripts/kernel/start-workflow.mjs --repo "C:/Users/Hi/AppData/Local/Temp/starci-host-outage-Zz/repo" --workflow wf-z' },
    { pid: 106, created: old, cmd: 'node D:/tools/other-watchdog.mjs.bak --repo C:/Temp/x' },
  ];
  const pure = findOrphans(procs, { knownRepos: ['D:/Repositories/nivo-backend'], runningWorkflows: new Set(['wf-nivo-fe-canon']), now: T0, minAgeMs: S.processes.orphanMinAgeMs });
  assert.deepEqual(pure.map((o) => o.pid), [101, 105], 'the listed repo, the repo-less Supervisor watchdog and a young loop are never orphans');

  const dbs = { 'nivo-backend': ledgerDb({ workflows: [{ id: 'wf-nivo-fe-canon', goal: GOAL }] }) };
  const c = controller({ listProcesses: async () => procs });
  const ctx = fakeCtx({ dbs });
  const r = await c.reconcile('host:processes', ctx);
  assert.deepEqual(r.orphans.map((o) => o.pid), [101, 105]);
  const kills = ctx.calls.run.filter((x) => x.cmd === 'taskkill.exe');
  assert.deepEqual(kills.map((k) => k.args), [['/F', '/T', '/PID', '101'], ['/F', '/T', '/PID', '105']]);
  assert.ok(!kills.some((k) => k.args.includes('102')), 'a listed repo is never stopped');
  assert.deepEqual(ctx.calls.clock.filter((x) => x.code === 'ORPHAN_PROCESS').map((x) => x.entity), ['process:101', 'process:105']);
  assert.ok(ctx.calls.run.some((x) => x.args[0] === 'scripts/guards/footprint-scan.mjs'), 'the footprint scan is due on the first pass');

  ctx.advance(S.processes.everyMs);
  const c2 = procs.filter((p) => p.pid !== 101);
  const again = controller({ listProcesses: async () => c2 });
  again._state.orphanClocks = new Set(['process:101', 'process:105']);
  await again.reconcile('host:processes', ctx);
  assert.ok(ctx.calls.clear.some((x) => x.entity === 'process:101' && x.state === 'orphan'), 'a stopped orphan clears its clock');
});

test('the runaway shim chains hostVerdict marks safe are stopped; the terminal count drift is a clock', async () => {
  const dbs = { 'nivo-backend': ledgerDb({ workflows: [{ id: 'wf-a', goal: GOAL }], jobs: [{ id: 'j1', status: 'running', worker: 't1' }, { id: 'j2', status: 'settled', worker: 't2' }] }) };
  const c = controller({ listProcesses: async () => [{ pid: 1 }], hostVerdict: async () => ({ stop: [{ kind: 'guard-shim-recursion', rootPid: 777 }], alert: false }), orcaTerminals: async () => 9 });
  const ctx = fakeCtx({ dbs });
  const r = await c.reconcile('host:processes', ctx);
  assert.deepEqual(r.stopped, [{ kind: 'guard-shim-recursion', pid: 777 }]);
  assert.deepEqual(r.terminals, { count: 9, expected: 1 + 1 + 1 + S.processes.terminalSlack, seats: 2, workers: 1 });
  assert.ok(ctx.calls.clock.some((x) => x.code === 'TERMINAL_COUNT_DRIFT' && x.count === 9 && x.expected === 8));
});

test('boot: waits for Orca, then services in order, dedupe (dry-run in shadow), reconcile per ledger, then seats', async () => {
  const dbs = { 'nivo-backend': ledgerDb({ workflows: [{ id: 'wf-a', goal: GOAL }] }) };
  let orcaUp = false;
  const c = controller({ registry: () => noopRegistry((n) => (n === 'orca' ? orcaUp : true)), probeSeat: async () => ({ action: 'active' }) });
  const ctx = fakeCtx({ dbs });
  assert.deepEqual((await c.list(ctx)).slice(0, 2), ['host:boot', 'service:orca']);
  assert.deepEqual(await c.reconcile('seat:kernel:nivo-backend:wf-a', ctx), { ok: true, deferred: 'boot' }, 'no seat before the boot dedupe');
  const down = await c.reconcile('host:boot', ctx);
  assert.equal(down.waiting, 'orca');
  assert.equal(c._state.bootPending, true);
  orcaUp = true;
  ctx.advance(60_000);
  const up = await c.reconcile('host:boot', ctx);
  assert.equal(up.ok, true);
  assert.deepEqual(up.steps.map((s) => s.step), ['orca', 'harness-ui', 'harness-tunnel', 'ask-gateway', 'ask-tunnel', 'telegram-bridge', 'dedupe',
    'reconcile --orphan-kernel-jobs', 'reconcile --orca-tasks', 'seat', 'seat:supervisor']);
  assert.deepEqual(ctx.calls.api.map((a) => `${a.id} ${a.verb} ${a.argv.join(' ')}`), ['nivo-backend reconcile --orphan-kernel-jobs', 'nivo-backend reconcile --orca-tasks']);
  assert.equal(c._state.bootPending, false);
  assert.ok(!(await c.list(ctx)).includes('host:boot'));
});

test('Orca failed -> healthy asks for the boot order again', async () => {
  let orcaUp = false;
  const c = booted(controller({ registry: () => noopRegistry((n) => (n === 'orca' ? orcaUp : true)) }));
  const ctx = fakeCtx({ dbs: { 'nivo-backend': ledgerDb() } });
  await c.reconcile('service:orca', ctx);
  assert.equal(c._state.bootPending, false);
  orcaUp = true; ctx.advance(60_000);
  await c.reconcile('service:orca', ctx);
  assert.equal(c._state.bootPending, true);
});

test('a service that keeps failing: its start goes through ctx.run, then a quarantine opens one DI', async () => {
  const store = memoryStore();
  const reg = () => noopRegistry((n) => n !== 'telegram-bridge').map((e) => ({ ...e, startTimeoutMs: 1 }));
  const c = booted(controller({ store: () => store, registry: reg }));
  const ctx = fakeCtx({ dbs: { 'nivo-backend': ledgerDb() } });
  for (let i = 0; i < 20; i += 1) { await c.reconcile('service:telegram-bridge', ctx); ctx.advance(60_000); }
  const starts = ctx.calls.run.filter((r) => r.args.join(' ') === 'scripts/reconciler/services.mjs --start telegram-bridge --json');
  assert.equal(starts.length, 5);
  const dis = ctx.calls.decisions.filter((d) => d.kind === 'service-quarantined');
  assert.equal(dis.length, 1);
  assert.equal(dis[0].severity, 'critical', 'the bridge is on the owner path');
  assert.ok(ctx.calls.clock.some((x) => x.entity === 'service:telegram-bridge' && x.code === 'SERVICE_DOWN'));
  assert.equal(store.get('telegram-bridge').state, 'quarantined');
  await c.reconcile('service:orca', ctx);
  assert.ok(ctx.calls.clear.some((x) => x.entity === 'service:orca' && x.state === 'down'));
});

test('ledger health: a failed quick_check is LEDGER_CORRUPT + one DI; the nightly backup is recorded once a day', async () => {
  const ledgers = [{ ledgerId: 'nivo-backend', repo: 'D:/r', file: 'D:/r/.starciwork/runtime.sqlite' }];
  let ok = false;
  const c = controller({ quickCheck: () => (ok ? { ok: true, result: ['ok'] } : { ok: false, result: ['*** in database main ***', 'page 7: btree'] }), backupDue: () => true });
  const ctx = fakeCtx({ ledgers, dbs: { 'nivo-backend': ledgerDb() } });
  await c.reconcile('ledger:nivo-backend', ctx);
  assert.ok(ctx.calls.clock.some((x) => x.code === 'LEDGER_CORRUPT' && x.severity === 'critical'));
  assert.equal(ctx.calls.decisions.length, 1);
  assert.equal(ctx.calls.run.length, 0, 'no backup of a corrupt ledger');
  ctx.advance(S.ledgerHealth.quickCheckEveryMs);
  await c.reconcile('ledger:nivo-backend', ctx);
  assert.equal(ctx.calls.decisions.length, 1, 'still corrupt: no second DI');
  ok = true; ctx.advance(S.ledgerHealth.quickCheckEveryMs);
  await c.reconcile('ledger:nivo-backend', ctx);
  assert.ok(ctx.calls.clear.some((x) => x.entity === 'ledger:nivo-backend' && x.state === 'corrupt'));
  const backups = ctx.calls.run.filter((r) => r.args[0] === 'scripts/reconciler/ledger-health.mjs');
  assert.equal(backups.length, 1);
  assert.deepEqual(backups[0].args, ['scripts/reconciler/ledger-health.mjs', '--backup', '--ledger-id', 'nivo-backend', '--file', 'D:/r/.starciwork/runtime.sqlite', '--json']);
  ctx.advance(60_000);
  await c.reconcile('ledger:nivo-backend', ctx);
  assert.equal(ctx.calls.run.filter((r) => r.args[0] === 'scripts/reconciler/ledger-health.mjs').length, 1, 'once a day');
});

test('the supervisor seat runs its watchdog pass through ctx.run; chat mode runs nothing', async () => {
  const ctx = fakeCtx({ dbs: { 'nivo-backend': ledgerDb() } });
  await booted(controller()).reconcile('seat:supervisor', ctx);
  assert.deepEqual(ctx.calls.run.map((r) => r.args), [['scripts/supervisor/watchdog.mjs', '--once', '--json']]);
  const chat = fakeCtx({ dbs: { 'nivo-backend': ledgerDb() } });
  assert.equal((await booted(controller({ supervisorMode: async () => 'chat' })).reconcile('seat:supervisor', chat)).skipped, 'chat-mode');
  assert.equal(chat.calls.run.length, 0);
});

test('the module export matches the shared contract', async () => {
  const mod = (await import('../scripts/reconciler/controllers/host.mjs')).default;
  assert.equal(mod.name, 'host');
  assert.deepEqual(mod.concerns, ['host.kernel-seat', 'host.supervisor-seat', 'host.services', 'host.orca', 'host.processes', 'host.ledger-health']);
  assert.equal(typeof mod.list, 'function');
  assert.equal(typeof mod.reconcile, 'function');
  assert.equal(mod.routes['workflow-finished']({ ledgerId: 'l', workflowId: 'wf-x' }), 'seat:kernel:l:wf-x');
});
