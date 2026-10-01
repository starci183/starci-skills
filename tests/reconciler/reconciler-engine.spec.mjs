// The reconciler engine (scripts/reconciler/engine.mjs; contract modules/reconciler/reconciler.yaml): leader election and
// the epoch fence, the shadow gate of ctx.api, event routing, isolation of a throwing controller, and --once.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Engine, discoverControllers } from '../../scripts/reconciler/engine.mjs';
import { createCtx } from '../../scripts/reconciler/ctx.mjs';
import { pollLedger, routeEvent } from '../../scripts/reconciler/sources.mjs';
import { WorkQueue, machineRows } from '../../scripts/reconciler/workqueue.mjs';
import { tempState, fakeCtx } from '../../scripts/reconciler/testing.mjs';
import { validateLogData } from '../../scripts/kernel/typed-logs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
const NUMBERS = { pollMs: 2000, leaseMs: 30000, renewMs: 10000, heartbeatStaleMs: 60000, statusCacheMs: 20000, backoff: { minMs: 1000, maxMs: 300000 }, crashLoop: { max: 3, windowMs: 1800000 } };
const noLock = () => ({ ok: true, release() {} });
const allShadow = () => ({ enabled: true, controllers: { job: { mode: 'shadow' }, host: { mode: 'shadow' } } });

/** A minimal ledger file with the events table of engine/db/migrations/runtime/0001-init.sql (the columns sources.mjs reads). */
function eventsLedger(dir, name = 'ledger.sqlite') {
  const file = path.join(dir, name);
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE, workflow_id TEXT NOT NULL, generation INTEGER NOT NULL DEFAULT 0,
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT, prev_digest TEXT, digest TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`);
  const ledgerId = crypto.randomUUID();
  db.exec('CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT)');
  db.prepare("INSERT INTO meta(key,value) VALUES('ledger_id',?)").run(ledgerId);
  let n = 0;
  const append = (kind, entityId, workflowId = 'wf-a', entityType = 'job') => {
    n += 1;
    db.prepare('INSERT INTO events(event_id,workflow_id,entity_type,entity_id,kind,created_at) VALUES(?,?,?,?,?,?)').run(`ev-${name}-${n}`, workflowId, entityType, entityId, kind, Date.now());
  };
  return { file, ledgerId, append, close: () => db.close() };
}
/** The fixture ledger is no starci/runtime@1 file: read it without the ledger-db verification. */
const fixtureReader = (file) => new DatabaseSync(file, { readOnly: true });

test('two engines: one leader; the standby takes over after the lease with epoch + 1 and the old leader is fenced', (t) => {
  const st = tempState();
  t.after(() => st.close());
  let clock = 1_000_000;
  const now = () => clock;
  const mk = (holder) => new Engine({ env: st.env, now, numbers: NUMBERS, config: allShadow, ledgers: [], controllers: [], stateOptions: { file: st.file },
    holder, claimLock: noLock, writeLog: () => {}, print: () => {} });
  const a = mk('host:1:a'), b = mk('host:2:b');
  st.own({ close: () => { a.close({ releaseLead: false }); b.close({ releaseLead: false }); } });
  a.refreshConfig(); b.refreshConfig();
  const ga = a.acquire();
  assert.equal(ga.ok, true);
  assert.equal(ga.epoch, 1);
  const gb = b.acquire();
  assert.equal(gb.ok, false, 'a live lease keeps the second engine on standby');
  assert.match(gb.standby, /host:1:a/);
  assert.equal(a.isCurrentEpoch(), true);
  clock += 5_000;
  assert.equal(a.renew(), true, 'the leader renews');
  clock += NUMBERS.leaseMs + 1;
  const gb2 = b.acquire();
  assert.equal(gb2.ok, true, 'the standby takes over once the lease ran out');
  assert.equal(gb2.epoch, 2, 'the epoch increments on takeover');
  assert.equal(a.isCurrentEpoch(), false, 'the old leader is fenced');
  assert.equal(a.renew(), false, 'the old leader sees it lost the row');
  assert.equal(a.lost, true);
  assert.equal(b.isCurrentEpoch(), true);
  const modes = st.m.controllerModes();
  assert.equal(modes.job, 'shadow');
  assert.equal(modes.gc, 'off', 'an unnamed controller is off');
  assert.ok(st.m.modeChanges().some((c) => c.controller === 'gc' && c.to_mode === 'off' && /^engine:/.test(c.by)), 'a mode change says who and why');
  assert.deepEqual(st.m.leaderHistory().map((h) => [h.epoch, h.acquired_how, h.release_reason]), [[2, 'takeover-stale', null], [1, 'fresh', 'lost']], 'every epoch is history');
});

test('safe mode and --once without --apply run an active controller as shadow', (t) => {
  const st = tempState();
  t.after(() => st.close());
  const e = new Engine({ env: st.env, numbers: NUMBERS, safe: true, config: () => ({ enabled: true, controllers: { job: { mode: 'active' } } }), ledgers: [], controllers: [],
    stateOptions: { file: st.file }, claimLock: noLock, writeLog: () => {}, print: () => {} });
  st.own(e);
  e.refreshConfig();
  assert.equal(e.modes.job, 'shadow');
});

test('a shadow controller\'s ctx.api spawns nothing and writes one reconciler.would row; active spawns, journaled and fenced', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  const spawned = [], rows = [];
  const spawnChild = async (cmd, args, opts) => { spawned.push({ cmd, args, env: opts.env }); return { ok: true, code: 0, value: { ok: true } }; };
  const ledgers = [{ ledgerId: 'nivo', repo: 'D:/Repositories/nivo-backend', file: 'none' }];
  const shared = { statusCache: new Map(), wouldSeen: new Map() };
  const shadow = createCtx({ controller: 'job', mode: 'shadow', key: 'job:nivo:j1', state: st.db, epoch: 3, ledgers, spawnChild, writeLog: (r) => rows.push(r), shared });
  const r = await shadow.api('nivo', 'settle', ['--job', 'j1', '--verdict', 'pass']);
  assert.deepEqual(r, { ok: true, shadow: true });
  assert.equal(spawned.length, 0, 'shadow spawns no child');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'reconciler.would');
  assert.deepEqual(validateLogData('reconciler.would', rows[0].data), [], 'the row fits its typed-log kind');
  assert.equal(rows[0].data.controller, 'job');
  assert.match(rows[0].data.argv, /--job j1 --verdict pass --json/);
  await shadow.api('nivo', 'settle', ['--job', 'j1', '--verdict', 'pass']);
  assert.equal(rows.length, 1, 'the same would-call is recorded once per window');
  const ran = await shadow.run('node', ['scripts/supervisor/gc.mjs', '--apply']);
  assert.equal(ran.shadow, true);
  const di = await shadow.openDecision({ kind: 'settle-nongreen', idempotencyKey: 'k1', decider: 'kernel' });
  assert.equal(di.shadow, true);
  assert.equal(spawned.length, 0);
  assert.equal(shadow.owns('job.settle'), false);

  let current = true;
  const active = createCtx({ controller: 'job', mode: 'active', key: 'job:nivo:j1', state: st.db, epoch: 3, ledgers, spawnChild, writeLog: (r2) => rows.push(r2), shared,
    isCurrentEpoch: () => current, modes: { job: 'active' } });
  const done = await active.api('nivo', 'settle', ['--job', 'j1']);
  assert.equal(done.ok, true);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].env.STARCI_ACTOR, 'reconciler/job');
  assert.equal(spawned[0].env.STARCI_RECONCILER_EPOCH, '3');
  assert.deepEqual(spawned[0].args.slice(1, 4), ['settle', '--repo', 'D:/Repositories/nivo-backend']);
  const journal = st.db.db.prepare('SELECT state, epoch, verb FROM engine_actions ORDER BY started_at').all();
  assert.deepEqual(journal.map((a) => [a.state, a.epoch, a.verb]), [['done', 3, 'api settle']]);
  current = false;
  const fenced = await active.api('nivo', 'settle', ['--job', 'j2']);
  assert.equal(fenced.fenced, true, 'a lost epoch runs nothing');
  assert.equal(spawned.length, 1);
  assert.equal(st.db.db.prepare("SELECT COUNT(*) AS n FROM engine_actions WHERE state='fenced'").get().n, 1, 'the fenced action is journaled as fenced');
  assert.equal(active.owns('job.settle'), true);
});

test('ctx.clock / ctx.clear keep one open episode per (entity, state); re-entering after a clear opens a new one', (t) => {
  const st = tempState();
  t.after(() => st.close());
  let clock = 1000;
  const ctx = createCtx({ controller: 'job', state: st.m, now: () => clock, writeLog: () => {} });
  ctx.clock('job:j1', 'reported', 180000, { ledgerId: 'nivo' });
  clock = 5000;
  ctx.clock('job:j1', 'reported', 180000);
  let rows = st.m.openSla();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].entered_at, 1000, 'a clock already running keeps its start');
  assert.equal(rows[0].ledger_id, 'nivo');
  assert.equal(ctx.clear('job:j1', 'reported'), true);
  clock = 9000;
  ctx.clock('job:j1', 'reported', 180000);
  rows = st.m.openSla();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].entered_at, 9000);
  const all = st.m.db.prepare('SELECT entered_at, cleared_at, clear_reason FROM sla_episodes ORDER BY episode_id').all();
  assert.deepEqual(all.map((r) => [r.entered_at, r.cleared_at != null, r.clear_reason]), [[1000, true, 'resolved'], [9000, false, null]], 'episodes are append-only history');
});

test('an event routes to its key: the first poll starts at MAX(seq), later events route through every controller', (t) => {
  const st = tempState();
  t.after(() => st.close());
  const led = eventsLedger(st.dir);
  st.own(led);
  led.append('op-reported', 'op-old'); // before the engine: never replayed
  const ledger = { ledgerId: 'nivo', repo: st.dir, file: led.file };
  st.m.registerLedger({ ledgerId: led.ledgerId, name: 'nivo', repoRoot: st.dir, file: led.file }); // its cursor is engine_cursors[ledger_id]
  const first = pollLedger(st.db, ledger, { reader: fixtureReader });
  assert.equal(first.first, true);
  assert.equal(first.events.length, 0, 'no replay');
  led.append('op-reported', 'op-1');
  led.append('land-succeeded', 'land-1', 'wf-supervisor', 'land');
  led.append('op-unrouted', 'op-2');
  const p = pollLedger(st.db, ledger, { reader: fixtureReader });
  assert.deepEqual(p.events.map((e) => e.kind), ['op-reported', 'land-succeeded', 'op-unrouted']);
  const controllers = [
    { name: 'job', routes: { 'op-reported': (ev) => `job:${ev.ledgerId}:${ev.entityId}` } },
    { name: 'fleet', routes: { 'land-*': () => 'fleet:land', 'op-reported': () => { throw Error('bad route'); } } },
  ];
  const routed = p.events.flatMap((ev) => routeEvent(ev, controllers));
  assert.deepEqual(routed.map((r) => [r.controller, r.key]), [['job', 'job:nivo:op-1'], ['fleet', 'fleet:land']]);
  assert.equal(pollLedger(st.db, ledger, { reader: fixtureReader }).events.length, 0, 'the cursor moved');
  assert.equal(st.m.cursorOf(led.ledgerId), 4, 'the cursor is keyed by the ledger id');

  const e = new Engine({ env: st.env, numbers: NUMBERS, config: allShadow, ledgers: [ledger], stateOptions: { file: st.file }, claimLock: noLock, reader: fixtureReader,
    controllers: [{ name: 'job', module: { name: 'job', routes: controllers[0].routes, reconcile: async () => {} } }], writeLog: () => {}, print: () => {} });
  st.own(e);
  return e.load().then(() => {
    led.append('op-reported', 'op-9');
    e.pollSources();
    const q = st.m.db.prepare('SELECT controller, key, reason FROM engine_queue').all();
    assert.deepEqual(q.map((r) => [r.controller, r.key]), [['job', 'job:nivo:op-9']]);
    assert.match(q[0].reason, /^event:op-reported:nivo:\d+$/);
  });
});

test('the workqueue dedupes, keeps one in flight per key, reruns a key added while in flight, and backs off', (t) => {
  const st = tempState();
  t.after(() => st.close());
  let clock = 0;
  const q = new WorkQueue({ rows: machineRows(st.m), now: () => clock, backoff: { minMs: 1000, maxMs: 4000 } });
  q.add('job', 'k1'); q.add('job', 'k1'); q.add('job', 'k2');
  const first = q.take('job', 1);
  assert.equal(first.length, 1);
  assert.equal(q.take('job', 1).length, 0, 'concurrency 1 holds while one runs');
  const more = q.take('job', 4);
  assert.deepEqual(more.map((i) => i.key), ['k2']);
  q.add('job', first[0].key, { reason: 'event' });
  q.done('job', first[0].key);
  assert.deepEqual(q.take('job', 4).map((i) => i.key), [first[0].key], 'an add during the run runs it once more');
  assert.equal(q.failed('job', first[0].key, Error('x')), 1000);
  assert.equal(q.take('job', 4).length, 0, 'backing off');
  clock = 1000;
  const again = q.take('job', 4);
  assert.equal(again.length, 1);
  assert.equal(q.failed('job', again[0].key, Error('y')), 2000);
  assert.equal(WorkQueue.backoffMs(10, { minMs: 1000, maxMs: 4000 }), 4000);
});

test('a throwing controller never stops the others; a broken module is skipped at discovery', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  const ran = [];
  const good = { name: 'host', resyncMs: 60000, async list() { return ['host:a', 'host:b']; }, async reconcile(key) { ran.push(key); } };
  const bad = { name: 'job', resyncMs: 60000, async list() { return ['job:x']; }, async reconcile() { throw Error('boom'); } };
  const logged = [];
  const e = new Engine({ env: st.env, numbers: NUMBERS, config: allShadow, ledgers: [], stateOptions: { file: st.file }, claimLock: noLock,
    controllers: [{ name: 'job', module: bad }, { name: 'host', module: good }], writeLog: (r) => logged.push(r), print: () => {} });
  st.own(e);
  await e.load();
  assert.equal(e.acquire().ok, true);
  await e.resyncDue();
  e.dispatch(); await e.drain();
  e.dispatch(); await e.drain();
  assert.deepEqual(ran.sort(), ['host:a', 'host:b']);
  const failing = st.m.db.prepare("SELECT tries, last_error FROM engine_queue WHERE controller='job'").get();
  assert.equal(failing.tries, 1);
  assert.match(failing.last_error, /boom/);
  assert.ok(logged.some((r) => r.kind === 'reconciler.error' && r.data.kind === 'reconciler.reconcile-failed'));
  assert.ok(logged.every((r) => validateLogData(r.kind, r.data).length === 0), 'every engine row fits its typed-log kind');

  const dir = path.join(st.dir, 'controllers');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'job.mjs'), "export default { name: 'job', async reconcile() {} };\n");
  fs.writeFileSync(path.join(dir, 'host.mjs'), "export default { name: 'host', ;\n");
  fs.writeFileSync(path.join(dir, 'gc.mjs'), "export default { name: 'other', async reconcile() {} };\n");
  const found = await discoverControllers(dir);
  assert.deepEqual(found.controllers.map((c) => c.name), ['job']);
  assert.deepEqual(found.errors.map((x) => x.name).sort(), ['gc', 'host']);
});

test('--once lists and reconciles every non-off controller once, in shadow unless --apply', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  const seen = [];
  const ctl = { name: 'job', concurrency: 2, async list() { return ['job:1', 'job:2', 'job:3']; }, async reconcile(key, ctx) { seen.push([key, ctx.mode]); await ctx.api('l', 'settle', ['--job', key]); } };
  const off = { name: 'gc', async list() { return ['gc:sweep']; }, async reconcile(key) { seen.push([key, 'off?']); } };
  const e = new Engine({ env: st.env, numbers: NUMBERS, apply: false, memoryQueue: true, config: () => ({ enabled: true, controllers: { job: { mode: 'active' } } }),
    ledgers: [{ ledgerId: 'l', repo: st.dir, file: 'none' }], stateOptions: { file: st.file }, claimLock: noLock,
    controllers: [{ name: 'job', module: ctl }, { name: 'gc', module: off }], writeLog: () => {}, print: () => {},
    spawnChild: async () => assert.fail('--once without --apply spawns nothing') });
  st.own(e);
  await e.load();
  const r = await e.once();
  assert.equal(r.ok, true);
  assert.deepEqual(r.controllers.map((c) => [c.name, c.mode, c.keys, c.ok]), [['job', 'shadow', 3, 3]]);
  assert.deepEqual(seen.map(([k, m]) => m), ['shadow', 'shadow', 'shadow']);
  assert.equal(st.m.db.prepare('SELECT COUNT(*) AS n FROM engine_queue').get().n, 0, 'a --once pass never touches the persisted queue');
  const one = await e.once({ controller: 'gc', key: 'gc:x' });
  assert.deepEqual(one.controllers.map((c) => [c.name, c.keys, c.ok]), [['gc', 1, 1]], 'a named controller runs even when off');

  // one named controller: the gc controller's real sweep (a child over every lane worktree and Orca terminal) takes minutes on a real host
  const cli = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'reconciler', 'engine.mjs'), '--once', '--controller', 'learning', '--json'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...st.env, STARCI_CONNECTORS_OFF: '1' } });
  assert.equal(cli.status, 0, cli.stderr);
  const out = JSON.parse(cli.stdout.trim().split(/\r?\n/).pop());
  assert.equal(out.ok, true);
  assert.equal(out.leader, false);
});

test('fakeCtx records gated calls and answers shadow', async () => {
  const ctx = fakeCtx({ status: { 'l:wf-a': { ok: true, phase: 'running' } } });
  assert.deepEqual(await ctx.api('l', 'settle', ['--job', 'j']), { ok: true, shadow: true });
  assert.equal((await ctx.status('l', 'wf-a')).phase, 'running');
  ctx.clock('job:j', 'reported', 1000);
  assert.equal(ctx.clear('job:j', 'reported'), true);
  assert.equal(ctx.calls.api.length, 1);
  assert.equal(ctx.owns('job.settle'), false);
});

test('one ctx per (controller, mode) whose key is the running reconcile; retryAfterMs requeues after that delay', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  let clock = 1_000_000;
  const seen = [];
  const ctl = { name: 'gc', concurrency: 2, async list() { return ['gc:a', 'gc:b']; },
    async reconcile(key, ctx) { await new Promise((r) => setTimeout(r, 5)); seen.push({ key, ctxKey: ctx.key, ctx, db: ctx.stateDb }); if (key === 'gc:b') throw Object.assign(Error('busy'), { retryAfterMs: 120_000 }); } };
  const e = new Engine({ env: st.env, now: () => clock, numbers: NUMBERS, config: () => ({ enabled: true, controllers: { gc: { mode: 'shadow' } } }), ledgers: [],
    stateOptions: { file: st.file }, claimLock: noLock, controllers: [{ name: 'gc', module: ctl }], writeLog: () => {}, print: () => {} });
  st.own(e);
  await e.load();
  assert.equal(e.acquire().ok, true);
  await e.resyncDue();
  e.dispatch(); await e.drain();
  assert.deepEqual(seen.map((x) => [x.key, x.ctxKey]).sort(), [['gc:a', 'gc:a'], ['gc:b', 'gc:b']], 'ctx.key is the key of the reconcile in flight');
  assert.equal(seen[0].ctx, seen[1].ctx, 'one ctx object serves every reconcile of the controller');
  assert.ok(seen[0].db && typeof seen[0].db.prepare === 'function', 'ctx.stateDb is the engine connection');
  assert.equal(seen[0].ctx.machine, e.state, 'ctx.machine is the engine handle');
  const row = st.m.db.prepare("SELECT due_at, tries FROM engine_queue WHERE controller='gc' AND key='gc:b'").get();
  assert.equal(row.due_at, clock + 120_000, 'retryAfterMs overrides the exponential backoff');
});

test('events carry their parsed payload; ctx.log keeps the known kinds and files any other under reconciler.event / .error', (t) => {
  const st = tempState();
  t.after(() => st.close());
  const led = eventsLedger(st.dir);
  st.own(led);
  const ledger = { ledgerId: 'nivo', repo: st.dir, file: led.file };
  pollLedger(st.db, ledger, { reader: fixtureReader });
  led.append('worker-released-on-report', 'op-7');
  const [ev] = pollLedger(st.db, ledger, { reader: fixtureReader }).events;
  assert.equal(ev.jobId, 'op-7');
  assert.deepEqual(ev.payload, {});
  const rows = [];
  const ctx = createCtx({ controller: 'gc', writeLog: (r) => rows.push(r) });
  ctx.log('reconciler.gc.close', 'closed term_1', { handle: 'term_1' });
  ctx.log('reconciler.resource.error', 'footprint failed', {});
  ctx.log('reconciler.would', 'would close', { action: 'close', target: 'term_1' });
  ctx.log('invariant.violated', 'SETTLE_OVERDUE', { code: 'SETTLE_OVERDUE', severity: 'warn' });
  assert.deepEqual(rows.map((r) => [r.kind, r.data.kind ?? null]), [['reconciler.event', 'reconciler.gc.close'], ['reconciler.error', 'reconciler.resource.error'], ['reconciler.would', null], ['invariant.violated', null]]);
  for (const r of rows) assert.deepEqual(validateLogData(r.kind, r.data), [], `${r.kind} fits its typed-log kind`);
});

test('a failed action is classified by exit and JSON ok, never by stderr; result_json keeps the real error line, valid JSON', async (t) => {
  const st = tempState();
  t.after(() => st.close());
  const warn = '(node:9) ExperimentalWarning: SQLite is an experimental feature\n(Use `node --trace-warnings ...` to show where the warning was created)\n';
  const answers = [
    { ok: true, code: 0, value: { ok: true }, stderr: warn },
    { ok: false, code: 1, value: null, stderr: `${warn}file:///x/api.mjs:1\r\n  x\r\n  ^\r\n\r\nReferenceError: staleInputProjection is not defined\r\n    at file:///x` },
    { ok: false, code: 1, value: [{ repo: 'D:/Repositories/nivo-backend', pushed: false, scan: { ok: false, findings: [1, 2] } }], stderr: '' },
  ];
  let envSeen = null;
  const ctx = createCtx({ controller: 'host', mode: 'active', state: st.db, ledgers: [], writeLog: () => {},
    spawnChild: async (cmd, args, opts) => { envSeen = opts.env; return answers.shift(); } });
  await ctx.run('node', ['a.mjs']); await ctx.run('node', ['b.mjs']); await ctx.run('node', ['c.mjs']);
  assert.equal(envSeen.NODE_NO_WARNINGS, '1', 'children run without node warnings');
  const rows = st.m.db.prepare('SELECT state, result_json, result_sha, stderr_sha FROM engine_actions ORDER BY rowid').all();
  assert.deepEqual(rows.map((r) => r.state), ['done', 'failed', 'failed'], 'a warning on stderr is no failure');
  const errs = rows.map((r) => JSON.parse(r.result_json).error ?? null);
  assert.deepEqual(errs, [null, 'ReferenceError: staleInputProjection is not defined', 'nivo-backend: push scan: 2 finding(s)']);
  assert.ok(rows.every((r) => r.result_sha), 'the full result is a blob (MB-03)');
  assert.ok(rows[1].stderr_sha, 'the full stderr is a blob');
});
