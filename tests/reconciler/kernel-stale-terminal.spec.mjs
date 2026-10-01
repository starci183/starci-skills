import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { createHostController, staleTerminalsOf, STALE_RETRY_MS, STALE_ESCALATE_TRIES, CLOSE_VERIFY } from '../../scripts/reconciler/controllers/host.mjs';
import { hostSettings, memoryStore } from '../../scripts/reconciler/services.mjs';
import { fakeCtx } from '../../scripts/reconciler/testing.mjs';

// kernel-stale-terminal-unclosed (wf-nivo-auth-mum8xr9a inc-11df8ae56795): start-workflow closed the replaced Kernel
// terminal once, Orca read it disconnected but still listed it (a persisted tab), the incident opened with
// {proof: disconnected, attempts: 1} and nothing ever retried. The Host controller's seat pass now retries the
// verified close and resolves the incident on proof (gone, or no longer listed). Nothing here touches Orca.

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');
const S = hostSettings();
const T0 = Date.UTC(2026, 8, 29, 8, 0, 0);
const WF = 'wf-nivo-auth-mum8xr9a';
const SEAT = `seat:kernel:todo-app-be:${WF}`;
const OLD = 'term_3462bc7c-3dfe-455f-b041-6405c46382ef';
const LIVE = 'term_live-kernel';
const repo = path.join(os.tmpdir(), 'starci-fixture-repos', 'todo-app-be');

function ledgerDb({ incidents = [], seatTerminal = LIVE } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE workflows(workflow_id TEXT PRIMARY KEY, phase TEXT, archived_at INTEGER);
    CREATE TABLE goals(goal_seq INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT, revision INTEGER, markdown TEXT);
    CREATE TABLE incidents(incident_id TEXT PRIMARY KEY, workflow_id TEXT, status TEXT, last_progress TEXT);
    CREATE TABLE signals(scope TEXT, key TEXT, value_json TEXT);`);
  db.prepare('INSERT INTO workflows VALUES(?,?,?)').run(WF, 'running', null);
  db.prepare('INSERT INTO goals(workflow_id,revision,markdown) VALUES(?,?,?)').run(WF, 1, '# Goal\nShip auth.');
  if (seatTerminal) db.prepare("INSERT INTO signals VALUES('kernel',?,?)").run(WF, JSON.stringify({ terminal: seatTerminal }));
  for (const i of incidents) db.prepare('INSERT INTO incidents VALUES(?,?,?,?)').run(i.id, WF, i.status ?? 'open', i.text);
  return db;
}
const unclosed = (handle) => `[orca-tree] ${JSON.stringify({ code: 'kernel-stale-terminal-unclosed', handle, ok: false,
  verified: { ok: false, proof: 'disconnected', attempts: 1, reason: 'terminal-still-listed' }, error: 'terminal-still-listed' })}`;

function hostCtx({ mode = 'active', db, closeAnswer }) {
  const calls = { run: [], api: [], clock: [], clear: [], decisions: [], log: [] };
  let t = T0;
  const ctx = fakeCtx({
    mode, calls, now: () => t, advance: (ms) => { t += ms; },
    ledgers: [{ ledgerId: 'todo-app-be', repo, file: path.join(repo, '.starciwork', 'runtime.sqlite') }],
    read: (id, fn) => fn(db),
    run: async (cmd, args, o) => {
      calls.run.push({ cmd, args, o });
      if (mode !== 'active') return { ok: true, shadow: true };
      if (args[0] === CLOSE_VERIFY) { const v = closeAnswer(args[2]); return { ok: v.ok, stdout: `${JSON.stringify(v)}\n` }; }
      return { ok: true, stdout: JSON.stringify({ ok: true, action: 'active', terminal: LIVE }) };
    },
    api: async (id, verb, argv) => { calls.api.push({ id, verb, argv }); return { ok: true, shadow: mode !== 'active' }; },
    clock: () => {}, clear: () => {},
    openDecision: async (di) => { calls.decisions.push(di); return { ok: true }; },
    log: (kind, msg, data) => { calls.log.push({ kind, msg, data }); },
    owns: () => false,
  });
  return ctx;
}

function controller(over = {}) {
  const c = createHostController({
    settings: () => S, registry: () => [], store: () => memoryStore(),
    probeSeat: async () => ({ ok: true, action: 'active', terminal: LIVE }),
    listProcesses: async () => [], hostVerdict: async () => ({ alert: false }), orcaTerminals: async () => null,
    supervisorMode: async () => 'kernel', quickCheck: () => ({ ok: true, result: ['ok'] }), backupDue: () => false,
    probeTurn: async () => ({ ok: true, busy: false, state: 'turn-idle' }),
    turnNumbers: () => ({ kernelBudgetMs: 20 * 60_000, supervisorBudgetMs: 30 * 60_000, graceMs: 5 * 60_000 }),
    ...over,
  });
  c._state.bootPending = false;
  return c;
}
const closeRuns = (ctx) => ctx.calls.run.filter((r) => r.args[0] === CLOSE_VERIFY);
const resolves = (ctx) => ctx.calls.api.filter((a) => a.verb === 'incident' && a.argv.includes('--resolve'));

test('staleTerminalsOf: the handle of each open unclosed incident, never the live seat', () => {
  const rows = [{ incident_id: 'inc-a', last_progress: unclosed(OLD) }, { incident_id: 'inc-b', last_progress: unclosed(LIVE) },
    { incident_id: 'inc-c', last_progress: '[orca-tree] not json' }, { incident_id: 'inc-d', last_progress: '[x] {"code":"other","handle":"t"}' }];
  assert.deepEqual(staleTerminalsOf(rows, { liveHandle: LIVE }), [{ incidentId: 'inc-a', handle: OLD }]);
});

test('a replaced Kernel terminal read disconnected but still listed at replacement is closed again and its incident resolved once unlisted', async () => {
  const db = ledgerDb({ incidents: [{ id: 'inc-11df8ae56795', text: unclosed(OLD) }] });
  const c = controller({ terminalHandles: async () => new Set([LIVE]) });
  const ctx = hostCtx({ db, closeAnswer: (h) => ({ handle: h, ok: true, proof: 'disconnected', attempts: 1, tab: 'tab-1' }) });
  const r = await c.reconcile(SEAT, ctx);
  assert.equal(r.seat, 'live');
  assert.deepEqual(closeRuns(ctx).map((x) => x.args.slice(0, 3)), [[CLOSE_VERIFY, '--terminal', OLD]]);
  assert.ok(closeRuns(ctx)[0].args.includes('--tree'));
  assert.equal(resolves(ctx).length, 1);
  const argv = resolves(ctx)[0].argv;
  assert.deepEqual(argv.slice(0, 6), ['--workflow', WF, '--resolve', 'inc-11df8ae56795', '--by', 'supervisor']);
  assert.deepEqual(r.staleTerminals, [{ incidentId: 'inc-11df8ae56795', handle: OLD, closed: true, proof: 'unlisted', resolved: true }]);
});

test('proof gone resolves without a listing; the live seat terminal is never closed', async () => {
  const db = ledgerDb({ incidents: [{ id: 'inc-old', text: unclosed(OLD) }, { id: 'inc-live', text: unclosed(LIVE) }] });
  let listed = 0;
  const c = controller({ terminalHandles: async () => { listed += 1; return new Set(); } });
  const ctx = hostCtx({ db, closeAnswer: (h) => ({ handle: h, ok: true, proof: 'gone', attempts: 0 }) });
  await c.reconcile(SEAT, ctx);
  assert.deepEqual(closeRuns(ctx).map((x) => x.args[2]), [OLD]);
  assert.equal(listed, 0);
  assert.deepEqual(resolves(ctx).map((a) => a.argv[3]), ['inc-old']);
});

test('still listed: the incident stays open, the retry backs off, and the 6th failure opens one Decision Item', async () => {
  const db = ledgerDb({ incidents: [{ id: 'inc-11df8ae56795', text: unclosed(OLD) }] });
  const c = controller({ terminalHandles: async () => new Set([LIVE, OLD]) });
  const ctx = hostCtx({ db, closeAnswer: (h) => ({ handle: h, ok: true, proof: 'disconnected', attempts: 1 }) });
  const first = await c.reconcile(SEAT, ctx);
  assert.equal(resolves(ctx).length, 0);
  assert.equal(first.staleTerminals[0].reason, 'terminal-still-listed');
  await c.reconcile(SEAT, ctx);
  assert.equal(closeRuns(ctx).length, 1, 'no retry inside the backoff');
  for (let i = 0; i < STALE_ESCALATE_TRIES + 1; i += 1) { ctx.advance(STALE_RETRY_MS * 2 ** i); await c.reconcile(SEAT, ctx); }
  assert.ok(closeRuns(ctx).length >= STALE_ESCALATE_TRIES);
  assert.equal(resolves(ctx).length, 0);
  assert.equal(ctx.calls.decisions.filter((d) => String(d.idempotencyKey).startsWith('kernel-stale-terminal-unclosed:')).length, 1);
});

test('an unanswered listing or a failed close is no proof', async () => {
  const db = ledgerDb({ incidents: [{ id: 'inc-a', text: unclosed(OLD) }] });
  const c1 = controller({ terminalHandles: async () => null });
  const ctx1 = hostCtx({ db, closeAnswer: (h) => ({ handle: h, ok: true, proof: 'disconnected', attempts: 1 }) });
  assert.equal((await c1.reconcile(SEAT, ctx1)).staleTerminals[0].reason, 'terminal-list-unavailable');
  const c2 = controller({ terminalHandles: async () => new Set() });
  const ctx2 = hostCtx({ db, closeAnswer: (h) => ({ handle: h, ok: false, proof: null, attempts: 0, reason: 'host-unavailable' }) });
  assert.equal((await c2.reconcile(SEAT, ctx2)).staleTerminals[0].reason, 'host-unavailable');
  assert.equal(resolves(ctx1).length + resolves(ctx2).length, 0);
});

test('shadow records the close and resolves nothing; a resolved incident is left alone', async () => {
  const db = ledgerDb({ incidents: [{ id: 'inc-a', text: unclosed(OLD) }, { id: 'inc-done', status: 'resolved', text: unclosed('term_done') }] });
  const c = controller({ terminalHandles: async () => new Set() });
  const ctx = hostCtx({ mode: 'shadow', db, closeAnswer: () => { throw new Error('shadow never closes'); } });
  const r = await c.reconcile(SEAT, ctx);
  assert.deepEqual(closeRuns(ctx).map((x) => x.args[2]), [OLD]);
  assert.equal(resolves(ctx).length, 0);
  assert.deepEqual(r.staleTerminals, [{ incidentId: 'inc-a', handle: OLD, shadow: true }]);
});
