import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHostController, findOrphans, seatStateOf, goalProblem, outputOf, NEEDS_REPAIR, turnStep } from '../../scripts/reconciler/controllers/host.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { hostSettings, memoryStore, turnMinutesOf } from '../../scripts/reconciler/services.mjs';
import { goalTextRefusal } from '../../scripts/goal/goal-text.mjs';
import { quickCheck } from '../../scripts/reconciler/ledger-health.mjs';

import { fakeCtx } from '../../scripts/reconciler/testing.mjs';
// A ledger path is never a real-path literal: the fake ctx only names it, so it is built under the temp root.
const fixtureRepo = (name) => path.join(os.tmpdir(), 'starci-fixture-repos', name);
const fixtureLedger = (name) => path.join(fixtureRepo(name), '.starciwork', 'runtime.sqlite');
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

function hostCtx({ mode = 'shadow', now = T0, ledgers, dbs, runAnswer = null } = {}) {
  const calls = { run: [], api: [], clock: [], clear: [], decisions: [], log: [] };
  let t = now;
  const ctx = fakeCtx({
    mode, calls,
    now: () => t, advance: (ms) => { t += ms; },
    ledgers: ledgers ?? [{ ledgerId: 'todo-app-be', repo: fixtureRepo('todo-app-be'), file: fixtureLedger('todo-app-be') }],
    read: (id, fn) => fn(dbs[id]),
    run: async (cmd, args, o) => { calls.run.push({ cmd, args, o }); return mode === 'shadow' ? { ok: true, shadow: true } : (runAnswer?.(cmd, args) ?? { ok: true, stdout: '{}' }); },
    api: async (id, verb, argv) => { calls.api.push({ id, verb, argv }); return { ok: true, shadow: mode === 'shadow' }; },
    clock: (entity, state, slaMs, meta) => { calls.clock.push({ entity, state, slaMs, ...meta }); },
    clear: (entity, state) => { calls.clear.push({ entity, state }); },
    openDecision: async (di) => { calls.decisions.push(di); return { ok: true }; },
    log: (kind, msg, data) => { calls.log.push({ kind, msg, data }); },
    owns: () => false,
  });
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
    listProcesses: async () => [], hostVerdict: async () => ({ alert: false }), orcaTerminals: async () => null, activeWorkers: async () => [],
    supervisorMode: async () => 'kernel', quickCheck: () => ({ ok: true, result: ['ok'] }), backupDue: () => false,
    dedupeDryRun: async () => ({ ok: true, closed: [] }),
    probeTurn: async () => ({ ok: true, busy: false, state: 'turn-idle' }),
    turnNumbers: () => ({ kernelBudgetMs: 20 * 60_000, supervisorBudgetMs: 30 * 60_000, graceMs: 5 * 60_000 }),
    ...over,
  });
}
const booted = (c) => { c._state.bootPending = false; return c; };
const SEAT = 'seat:kernel:todo-app-be:wf-todo-app-fe-canon';
const repairRuns = (ctx) => ctx.calls.run.filter((r) => r.args[0] === 'scripts/kernel/kernel-watchdog.mjs');

test('pure helpers: seat states, goal problems, child output', () => {
  assert.equal(seatStateOf('restart-needed'), 'suspect');
  assert.equal(seatStateOf('restarted'), 'reserving');
  assert.equal(seatStateOf('host-unavailable'), 'hostOutage');
  assert.equal(seatStateOf('interactive-gate'), 'gated');
  assert.equal(seatStateOf('active'), 'live');
  assert.equal(goalProblem(null, goalTextRefusal), 'goal-text-missing');
  assert.equal(goalProblem('Kh\u1edfi \u0111\u1ed9ng l\u1ea1i\nGoal g\u1ed1c:\n\nnull', goalTextRefusal), 'goal-text-unresolved');
  assert.equal(goalProblem(GOAL, goalTextRefusal), null);
  assert.equal(outputOf({ ok: true, shadow: true }), null);
  assert.deepEqual(outputOf({ stdout: 'noise\n{"action":"restarted"}\n' }), { action: 'restarted' });
  assert.ok(NEEDS_REPAIR.has('restart-needed') && !NEEDS_REPAIR.has('active'));
});

test('shadow: probe action=restart-needed -> the --repair replace is recorded, never run', async () => {
  const dbs = { 'todo-app-be': ledgerDb({ workflows: [{ id: 'wf-todo-app-fe-canon', goal: GOAL }] }) };
  const store = memoryStore();
  const c = booted(controller({ store: () => store, probeSeat: async () => ({ ok: true, action: 'restart-needed' }) }));
  const ctx = hostCtx({ dbs });
  const r = await c.reconcile(SEAT, ctx);
  assert.equal(r.action, 'restart-needed');
  assert.equal(r.replaced, true);
  const runs = repairRuns(ctx);
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0].args, ['scripts/kernel/kernel-watchdog.mjs', '--repo', fixtureRepo('todo-app-be'), '--workflow', 'wf-todo-app-fe-canon', '--once', '--repair', '--json']);
  assert.equal(store.get(SEAT).restarts.length, 1);
  assert.equal(store.get(SEAT).state, 'suspect');
  assert.ok(ctx.calls.clock.some((c) => c.entity === SEAT && c.code === 'SEAT_VACANT'));
});

test('shadow: a live Kernel records no repair at all', async () => {
  const dbs = { 'todo-app-be': ledgerDb({ workflows: [{ id: 'wf-todo-app-fe-canon', goal: GOAL }] }) };
  const c = booted(controller({ probeSeat: async () => ({ ok: true, action: 'active' }) }));
  const ctx = hostCtx({ dbs });
  const r = await c.reconcile(SEAT, ctx);
  assert.equal(r.seat, 'live');
  assert.equal(ctx.calls.run.length, 0);
});

test('active: watchdog --once --repair runs through ctx.run and its action=restarted counts a replacement; the 4th in an hour quarantines', async () => {
  const dbs = { 'todo-app-be': ledgerDb({ workflows: [{ id: 'wf-todo-app-fe-canon', goal: GOAL }] }) };
  const store = memoryStore();
  const c = booted(controller({ store: () => store, probeSeat: async () => assert.fail('active mode does not probe first') }));
  const ctx = hostCtx({ dbs, mode: 'active', runAnswer: () => ({ ok: true, stdout: '{"ok":true,"action":"restarted"}' }) });
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
  const dbs = { 'todo-app-be': ledgerDb({ workflows: [{ id: 'wf-todo-app-fe-canon', goal: 'Kh\u1edfi \u0111\u1ed9ng l\u1ea1i tr\u00ean runtime m\u1edbi\nGoal g\u1ed1c:\n\nnull' }] }) };
  let probed = 0;
  const c = booted(controller({ probeSeat: async () => { probed += 1; return { action: 'restart-needed' }; } }));
  for (const mode of ['shadow', 'active']) {
    const ctx = hostCtx({ dbs, mode });
    const r1 = await c.reconcile(SEAT, ctx);
    await c.reconcile(SEAT, ctx);
    assert.equal(r1.refused, 'goal-text-unresolved');
    assert.equal(ctx.calls.run.length, 0, `${mode}: no seat is started`);
    assert.equal(new Set(ctx.calls.decisions.map((d) => d.idempotencyKey)).size, 1, `${mode}: one DI`);
    assert.equal(ctx.calls.decisions[0].kind, 'goal-text-missing');
    assert.equal(ctx.calls.decisions[0].decider, 'supervisor');
  }
  assert.equal(probed, 0);
  const missing = { 'todo-app-be': ledgerDb({ workflows: [{ id: 'wf-todo-app-fe-canon' }] }) };
  const ctx = hostCtx({ dbs: missing });
  assert.equal((await booted(controller()).reconcile(SEAT, ctx)).refused, 'goal-text-missing', 'no goal row at all is refused too');
});

test('an orphan watchdog of a temp repo -> stop planned + ORPHAN_PROCESS clock; a listed repo -> never', async () => {
  const old = T0 - 45 * 60_000; const DRIVE = path.parse(os.tmpdir()).root; const D = DRIVE.replace(/\\/g, '/'); const KNOWN = `${D}Repositories/todo-app-be`;
  const procs = [
    { pid: 101, created: old, cmd: `"${DRIVE}Program Files\\nodejs\\node.exe" ${DRIVE}Repositories\\ecommerce-app\\.claude\\scripts\\kernel\\watchdog.mjs --repo ${DRIVE}Temp\\starci-host-outage-Ab12\\repo --workflow wf-test-outage --repair` },
    { pid: 102, created: old, cmd: `node ${DRIVE}Repositories\\ecommerce-app\\.claude\\scripts\\kernel\\watchdog.mjs --repo ${DRIVE}Repositories\\todo-app-be --workflow wf-todo-app-fe-canon --repair` },
    { pid: 103, created: old, cmd: `node ${D}Repositories/ecommerce-app/.claude/scripts/supervisor/supervisor-watchdog.mjs` },
    { pid: 104, created: T0 - 5 * 60_000, cmd: `node scripts/kernel/ask-server.mjs --repo ${D}Temp/starci-x/repo --workflow wf-y` },
    { pid: 105, created: old, cmd: `starci workflow start --repo "${D}Temp/starci-host-outage-Zz/repo" --workflow wf-z` },
    { pid: 106, created: old, cmd: `node ${D}tools/other-watchdog.mjs.bak --repo ${D}Temp/x` },
  ];
  const pure = findOrphans(procs, { knownRepos: [KNOWN], runningWorkflows: new Set(['wf-todo-app-fe-canon']), now: T0, minAgeMs: S.processes.orphanMinAgeMs });
  assert.deepEqual(pure.map((o) => o.pid), [101, 105], 'the listed repo, the repo-less Supervisor watchdog and a young loop are never orphans');

  const dbs = { 'todo-app-be': ledgerDb({ workflows: [{ id: 'wf-todo-app-fe-canon', goal: GOAL }] }) };
  const c = controller({ listProcesses: async () => procs });
  const ctx = hostCtx({ dbs });
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
  assert.ok(ctx.calls.clear.some((x) => x.entity === 'process:101' && x.state === 'ORPHAN_PROCESS'), 'a stopped orphan clears its clock');
});

test('process counts over threshold are logged and nothing is stopped for them; the terminal count drift is a clock', async () => {
  const dbs = { 'todo-app-be': ledgerDb({ workflows: [{ id: 'wf-a', goal: GOAL }], jobs: [{ id: 'j1', status: 'running', worker: 't1' }, { id: 'j2', status: 'settled', worker: 't2' }] }) };
  // Orca's active workers over every Run (the Supervisor seat, the Kernel, one op): the count the drift is measured against.
  const active = [{ dispatchId: 'ctx_sup', terminalState: 'active' }, { dispatchId: 'ctx_k', terminalState: 'active' }, { dispatchId: 'ctx_op', terminalState: 'active' }];
  const c = controller({ listProcesses: async () => [{ pid: 1 }], hostVerdict: async () => ({ alert: true, counts: { node: 400, git: 5, all: 900 }, topParents: [] }), orcaTerminals: async () => 9, activeWorkers: async () => active });
  const ctx = hostCtx({ dbs });
  const r = await c.reconcile('host:processes', ctx);
  assert.equal(r.stopped, undefined);
  assert.deepEqual(ctx.calls.run.filter((x) => x.cmd === 'taskkill.exe'), [], 'a count over threshold stops nothing');
  assert.deepEqual(ctx.calls.log.filter((x) => x.kind === 'reconciler.host.runaway').map((x) => x.data.counts), [{ node: 400, git: 5, all: 900 }]);
  assert.deepEqual(r.terminals, { count: 9, expected: 3 + S.processes.terminalSlack, workers: 3 });
  assert.ok(ctx.calls.clock.some((x) => x.code === 'TERMINAL_COUNT_DRIFT' && x.count === 9 && x.expected === 8));
  // An Orca that answers for one bound Run only (or not at all) proves nothing: no count, no clock.
  const blind = controller({ listProcesses: async () => [], hostVerdict: async () => ({ alert: false }), orcaTerminals: async () => 9, activeWorkers: async () => null });
  const ctx2 = hostCtx({ dbs });
  assert.equal((await blind.reconcile('host:processes', ctx2)).terminals, undefined);
  assert.ok(!ctx2.calls.clock.some((x) => x.code === 'TERMINAL_COUNT_DRIFT'));
});

test('boot: waits for Orca, then services in order, dedupe (dry-run in shadow), reconcile per ledger, then seats', async () => {
  const dbs = { 'todo-app-be': ledgerDb({ workflows: [{ id: 'wf-a', goal: GOAL }] }) };
  let orcaUp = false;
  const c = controller({ registry: () => noopRegistry((n) => (n === 'orca' ? orcaUp : true)), probeSeat: async () => ({ action: 'active' }) });
  const ctx = hostCtx({ dbs });
  assert.deepEqual((await c.list(ctx)).slice(0, 2), ['host:boot', 'service:orca']);
  assert.deepEqual(await c.reconcile('seat:kernel:todo-app-be:wf-a', ctx), { ok: true, deferred: 'boot' }, 'no seat before the boot dedupe');
  const down = await c.reconcile('host:boot', ctx);
  assert.equal(down.waiting, 'orca');
  assert.equal(c._state.bootPending, true);
  orcaUp = true;
  ctx.advance(60_000);
  const up = await c.reconcile('host:boot', ctx);
  assert.equal(up.ok, true);
  assert.deepEqual(up.steps.map((s) => s.step), ['orca', 'harness-ui', 'harness-tunnel', 'ask-gateway', 'ask-tunnel', 'telegram-bridge', 'dedupe',
    'reconcile --orphan-kernel-jobs', 'seat', 'seat:supervisor']);
  assert.deepEqual(ctx.calls.api.map((a) => `${a.id} ${a.verb} ${a.argv.join(' ')}`), ['todo-app-be reconcile --orphan-kernel-jobs']);
  assert.equal(c._state.bootPending, false);
  assert.ok(!(await c.list(ctx)).includes('host:boot'));
});

test('Orca failed -> healthy asks for the boot order again', async () => {
  let orcaUp = false;
  const c = booted(controller({ registry: () => noopRegistry((n) => (n === 'orca' ? orcaUp : true)) }));
  const ctx = hostCtx({ dbs: { 'todo-app-be': ledgerDb() } });
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
  const ctx = hostCtx({ dbs: { 'todo-app-be': ledgerDb() } });
  for (let i = 0; i < 20; i += 1) { await c.reconcile('service:telegram-bridge', ctx); ctx.advance(60_000); }
  const starts = ctx.calls.run.filter((r) => r.args.join(' ') === 'scripts/reconciler/services.mjs --start telegram-bridge --json');
  assert.equal(starts.length, 5);
  const dis = ctx.calls.decisions.filter((d) => d.kind === 'service-quarantined');
  assert.equal(dis.length, 1);
  assert.equal(dis[0].severity, 'critical', 'the bridge is on the owner path');
  assert.ok(ctx.calls.clock.some((x) => x.entity === 'service:telegram-bridge' && x.code === 'SERVICE_DOWN'));
  assert.equal(store.get('telegram-bridge').state, 'quarantined');
  await c.reconcile('service:orca', ctx);
  assert.ok(ctx.calls.clear.some((x) => x.entity === 'service:orca' && x.state === 'SERVICE_DOWN'));
});

test('ledger health: a failed quick_check is LEDGER_CORRUPT + one DI; the nightly backup is recorded once a day', async () => {
  const ledgers = [{ ledgerId: 'todo-app-be', repo: fixtureRepo('r'), file: fixtureLedger('r') }];
  let ok = false;
  const c = controller({ quickCheck: () => (ok ? { ok: true, result: ['ok'] } : { ok: false, result: ['*** in database main ***', 'page 7: btree'] }), backupDue: () => true });
  const ctx = hostCtx({ ledgers, dbs: { 'todo-app-be': ledgerDb() } });
  await c.reconcile('ledger:todo-app-be', ctx);
  assert.ok(ctx.calls.clock.some((x) => x.code === 'LEDGER_CORRUPT' && x.severity === 'critical'));
  assert.equal(ctx.calls.decisions.length, 1);
  assert.equal(ctx.calls.run.length, 0, 'no backup of a corrupt ledger');
  ctx.advance(S.ledgerHealth.quickCheckEveryMs);
  await c.reconcile('ledger:todo-app-be', ctx);
  assert.equal(ctx.calls.decisions.length, 1, 'still corrupt: no second DI');
  ok = true; ctx.advance(S.ledgerHealth.quickCheckEveryMs);
  await c.reconcile('ledger:todo-app-be', ctx);
  assert.ok(ctx.calls.clear.some((x) => x.entity === 'ledger:todo-app-be' && x.state === 'LEDGER_CORRUPT'));
  const backups = ctx.calls.run.filter((r) => r.args[0] === 'scripts/reconciler/ledger-health.mjs');
  assert.equal(backups.length, 1);
  assert.deepEqual(backups[0].args, ['scripts/reconciler/ledger-health.mjs', '--backup', '--ledger-id', 'todo-app-be', '--file', fixtureLedger('r'), '--json']);
  ctx.advance(60_000);
  await c.reconcile('ledger:todo-app-be', ctx);
  assert.equal(ctx.calls.run.filter((r) => r.args[0] === 'scripts/reconciler/ledger-health.mjs').length, 1, 'once a day');
});

test('the supervisor seat runs its watchdog pass through ctx.run; chat mode runs nothing', async () => {
  const ctx = hostCtx({ dbs: { 'todo-app-be': ledgerDb() } });
  await booted(controller()).reconcile('seat:supervisor', ctx);
  assert.deepEqual(ctx.calls.run.map((r) => r.args), [['scripts/supervisor/supervisor-watchdog.mjs', '--once', '--json']]);
  const chat = hostCtx({ dbs: { 'todo-app-be': ledgerDb() } });
  assert.equal((await booted(controller({ supervisorMode: async () => 'chat' })).reconcile('seat:supervisor', chat)).skipped, 'chat-mode');
  assert.equal(chat.calls.run.length, 0);
});

test('the module export matches the shared contract', async () => {
  const mod = (await import('../../scripts/reconciler/controllers/host.mjs')).default;
  assert.equal(mod.name, 'host');
  assert.deepEqual(mod.concerns, ['host.kernel-seat', 'host.supervisor-seat', 'host.services', 'host.orca', 'host.processes', 'host.ledger-health']);
  assert.equal(typeof mod.list, 'function');
  assert.equal(typeof mod.reconcile, 'function');
  assert.equal(mod.routes['workflow-finished']({ ledgerId: 'l', workflowId: 'wf-x' }), 'seat:kernel:l:wf-x');
});

/* ------------------------------------------------------------ turn budget (KERNEL_TURN_OVERDUE) */

const TB = { budgetMs: 20 * 60_000, graceMs: 5 * 60_000, sameTurnSlackMs: 180_000 };

test('turnMinutesOf reads the spinner timer of Claude, Codex and Devin', () => {
  assert.equal(turnMinutesOf('● Read file\n✻ Cogitating… (12m 30s · ↓ 3.2k tokens · esc to interrupt)\n❯ '), 12);
  assert.equal(turnMinutesOf('• Working (1h 02m 13s • esc to interrupt)'), 62);
  assert.equal(turnMinutesOf('⠠⠤ Thinking · 5m 58s (esc twice to interrupt) · (457c · ctrl+o for'), 5);
  assert.equal(turnMinutesOf('✻ Pondering… (41s · esc to interrupt)'), 0);
  assert.equal(turnMinutesOf('❭ Ask Devin to build features\nSWE-2 Max'), null);
});

test('turnStep: over budget -> interrupt once; the same turn grace later -> replace once; a new turn starts over', () => {
  let t = T0, r = turnStep(null, { busy: true, minutes: 10 }, { now: t, ...TB });
  assert.equal(r.act, null);
  assert.equal(r.turn.startedAt, t - 10 * 60_000);
  r = turnStep(r.turn, { busy: true, minutes: 21 }, { now: t += 11 * 60_000, ...TB });
  assert.equal(r.act, 'interrupt');
  assert.equal(r.overdue, true);
  r = turnStep(r.turn, { busy: true, minutes: 23 }, { now: t += 2 * 60_000, ...TB });
  assert.equal(r.act, null, 'within the grace nothing more');
  const replace = turnStep(r.turn, { busy: true, minutes: 26 }, { now: t + 3 * 60_000, ...TB });
  assert.equal(replace.act, 'replace');
  assert.equal(turnStep(replace.turn, { busy: true, minutes: 27 }, { now: t + 4 * 60_000, ...TB }).act, null, 'replace once');
  const fresh = turnStep(r.turn, { busy: true, minutes: 1 }, { now: t + 3 * 60_000, ...TB });
  assert.equal(fresh.act, null, 'the interrupt worked: a new turn');
  assert.equal(fresh.ended, true);
  assert.equal(fresh.turn.interruptedAt, null);
  const idle = turnStep(r.turn, { busy: false }, { now: t, ...TB });
  assert.deepEqual([idle.turn, idle.act, idle.ended], [null, null, true]);
  let n = null;
  for (let i = 0; i <= 21; i += 1) n = turnStep(n?.turn ?? null, { busy: true, minutes: null }, { now: T0 + i * 60_000, ...TB });
  assert.equal(n.act, 'interrupt', 'no timer on screen: continuous busy readings count as one turn');
});

test('active Kernel seat: a 25-minute turn -> interrupt key + doorbell + re-wake pass, KERNEL_TURN_OVERDUE; still the same turn 5 min later -> replaced', async () => {
  const dbs = { 'todo-app-be': ledgerDb({ workflows: [{ id: 'wf-todo-app-fe-canon', goal: GOAL }] }) };
  const store = memoryStore();
  let minutes = 25, replaced = false;
  const c = booted(controller({ store: () => store, probeTurn: async () => ({ ok: true, busy: true, state: 'active', minutes, terminal: 'term_k', agent: 'devin' }) }));
  const ctx = hostCtx({ dbs, mode: 'active', runAnswer: (cmd, args) => {
    if (args.includes('--turn-replace')) { replaced = true; return { ok: true, stdout: '{"ok":true}' }; }
    const action = replaced ? 'restarted' : 'active';
    return { ok: true, stdout: JSON.stringify(args[0] === 'scripts/kernel/kernel-watchdog.mjs' ? { ok: true, action, terminal: 'term_k' } : { ok: true }) };
  } });
  const r1 = await c.reconcile(SEAT, ctx);
  assert.equal(r1.turn.act, 'interrupt');
  const argsOf = () => ctx.calls.run.map((x) => x.args.join(' '));
  assert.ok(argsOf().includes(`scripts/reconciler/services.mjs --turn-interrupt --terminal term_k --agent devin --repo ${fixtureRepo('todo-app-be')} --workflow wf-todo-app-fe-canon --json`));
  assert.equal(argsOf().filter((a) => a.startsWith('scripts/kernel/kernel-watchdog.mjs')).length, 2, 'the seat pass, then the re-wake pass');
  const overdue = ctx.calls.clock.find((x) => x.state === 'KERNEL_TURN_OVERDUE');
  assert.equal(overdue.entity, SEAT);
  assert.equal(overdue.enteredAt, T0 - 25 * 60_000, 'the clock starts at the turn start');
  assert.ok(ctx.calls.log.some((l) => l.kind === 'reconciler.host.turn-budget' && l.data.act === 'interrupt'));
  ctx.advance(2 * 60_000); minutes = 27;
  assert.equal((await c.reconcile(SEAT, ctx)).turn.act, null);
  ctx.advance(3 * 60_000); minutes = 30;
  const r3 = await c.reconcile(SEAT, ctx);
  assert.equal(r3.turn.act, 'replace');
  assert.ok(argsOf().includes('scripts/reconciler/services.mjs --turn-replace --terminal term_k --agent devin --json'));
  assert.ok(ctx.calls.log.some((l) => l.data?.act === 'replace'));
  assert.equal(store.get(SEAT).restarts.length, 1, 'the budget replacement counts toward the seat quarantine');
});

test('an interrupt that ends the turn clears KERNEL_TURN_OVERDUE and replaces nothing', async () => {
  const dbs = { 'todo-app-be': ledgerDb({ workflows: [{ id: 'wf-todo-app-fe-canon', goal: GOAL }] }) };
  let obs = { ok: true, busy: true, state: 'active', minutes: 21, terminal: 'term_k', agent: 'claude' };
  const c = booted(controller({ probeTurn: async () => obs }));
  const ctx = hostCtx({ dbs, mode: 'active' });
  await c.reconcile(SEAT, ctx);
  ctx.advance(6 * 60_000); obs = { ok: true, busy: false, state: 'turn-idle', minutes: null, terminal: 'term_k', agent: 'claude' };
  await c.reconcile(SEAT, ctx);
  assert.ok(ctx.calls.clear.some((x) => x.entity === SEAT && x.state === 'KERNEL_TURN_OVERDUE'));
  assert.ok(!ctx.calls.run.some((x) => x.args.includes('--turn-replace')));
});

test('shadow: an overdue turn records the interrupt, runs nothing, and a 19-minute turn is left alone', async () => {
  const dbs = { 'todo-app-be': ledgerDb({ workflows: [{ id: 'wf-todo-app-fe-canon', goal: GOAL }] }) };
  let minutes = 19;
  const c = booted(controller({ probeTurn: async () => ({ ok: true, busy: true, state: 'active', minutes, terminal: 'term_k', agent: 'devin' }) }));
  const ctx = hostCtx({ dbs });
  await c.reconcile(SEAT, ctx);
  assert.equal(ctx.calls.run.length, 0);
  ctx.advance(2 * 60_000); minutes = 21;
  await c.reconcile(SEAT, ctx);
  assert.deepEqual(ctx.calls.run.map((x) => x.args[1]), ['--turn-interrupt'], 'shadow records only the interrupt (ctx.run is the gate)');
});

test('the Supervisor seat has its own 30-minute budget and interrupts with --supervisor', async () => {
  let minutes = 25;
  const c = booted(controller({ probeTurn: async () => ({ ok: true, busy: true, state: 'active', minutes, terminal: 'term_s', agent: 'claude' }) }));
  const ctx = hostCtx({ dbs: { 'todo-app-be': ledgerDb() }, mode: 'active', runAnswer: () => ({ ok: true, stdout: '{"ok":true,"action":"busy","terminal":"term_s"}' }) });
  assert.equal((await c.reconcile('seat:supervisor', ctx)).turn.act, null);
  ctx.advance(6 * 60_000); minutes = 31;
  assert.equal((await c.reconcile('seat:supervisor', ctx)).turn.act, 'interrupt');
  assert.ok(ctx.calls.run.some((x) => x.args.join(' ') === 'scripts/reconciler/services.mjs --turn-interrupt --terminal term_s --agent claude --supervisor --json'));
  assert.equal(ctx.calls.clock.find((x) => x.state === 'KERNEL_TURN_OVERDUE').slaMs, 30 * 60_000);
});

test('every clock state the host controller sets is a code of the SLA catalogue', () => {
  const codes = parseYaml(fs.readFileSync(new URL('../../modules/reconciler/sla.yaml', import.meta.url), 'utf8')).codes;
  const src = fs.readFileSync(new URL('../../scripts/reconciler/controllers/host.mjs', import.meta.url), 'utf8');
  const used = [...src.matchAll(/await clock\(ctx, [^,]+, '([A-Z_]+)'/g)].map((m) => m[1]);
  used.push('SEAT_VACANT', 'KERNEL_GATED', 'ORCA_DOWN', 'KERNEL_INPUT_STUCK', 'SEAT_QUARANTINED');
  assert.ok(used.includes('KERNEL_TURN_OVERDUE') && used.includes('SERVICE_DOWN') && used.includes('LEDGER_CORRUPT'));
  for (const code of used) assert.ok(codes[code], `${code} is in modules/reconciler/sla.yaml codes`);
});

test('a service whose port still answers is never restarted, and a degraded pass starts no SERVICE_DOWN clock', async () => {
  const store = memoryStore();
  let answers = true;
  const reg = () => noopRegistry((n) => n !== 'harness-ui').map((e) => (e.name === 'harness-ui' ? { ...e, answers: async () => answers } : e));
  const c = booted(controller({ store: () => store, registry: reg }));
  const ctx = hostCtx({ dbs: { 'todo-app-be': ledgerDb() } });
  await c.reconcile('service:harness-ui', ctx);
  for (let i = 0; i < 12; i += 1) { ctx.advance(60_000); await c.reconcile('service:harness-ui', ctx); }
  assert.equal(ctx.calls.run.filter((r) => r.args.includes('harness-ui')).length, 0, 'answering: never restarted');
  assert.equal(store.get('harness-ui').restarts.length, 0, 'and nothing counts toward the quarantine');
  assert.ok(ctx.calls.log.some((l) => l.kind === 'reconciler.host.service-slow'));
  const flap = memoryStore();
  const c2 = booted(controller({ store: () => flap, registry: () => noopRegistry((n) => n !== 'orca') }));
  const ctx2 = hostCtx({ dbs: { 'todo-app-be': ledgerDb() } });
  flap.put({ name: 'orca', state: 'healthy', since: T0, restarts: [], failStreak: 0 });
  await c2.reconcile('service:orca', ctx2);
  assert.equal(flap.get('orca').state, 'degraded');
  assert.ok(!ctx2.calls.clock.some((x) => x.state === 'SERVICE_DOWN'), 'degraded is not down');
  answers = false; ctx.advance(60_000);
  await c.reconcile('service:harness-ui', ctx);
  assert.ok(ctx.calls.run.some((r) => r.args.join(' ') === 'scripts/reconciler/services.mjs --start harness-ui --json'), 'silent on its port: restarted');
});

test('quickCheck: a store the runtime refuses for its schema is not ok (a corrupt-class finding), never a legacy store', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-qc-'));
  try {
    const file = path.join(dir, 'runtime.sqlite');
    const db = new DatabaseSync(file); db.exec('CREATE TABLE t(a)'); db.close();
    assert.deepEqual(quickCheck(file, { verifiedOpen: () => ({ close() {} }) }), { ok: true, result: ['ok'] });
    const refuse = () => { throw Object.assign(new Error('schema refused'), { code: 'STARCI_LEDGER_SCHEMA_REFUSED' }); };
    const r = quickCheck(file, { verifiedOpen: refuse });
    assert.equal(r.ok, false);
    assert.equal(r.legacy, undefined);
    assert.match(r.result[0], /schema refused/);
    assert.equal(quickCheck(path.join(dir, 'absent.sqlite')).ok, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
