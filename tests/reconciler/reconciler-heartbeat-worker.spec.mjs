// The engine's heartbeat outlives a blocked main thread (scripts/reconciler/heartbeat-worker.mjs), a self-reload re-evaluates
// safe mode instead of inheriting --safe (engine.mjs safeForStart), start.mjs reads safe mode from the live state, and the
// process-table read the engine uses does not block its thread (ENGINE-STALL, 2026-09-29 14:06-14:15).
import test from 'node:test';
import assert from 'node:assert/strict';
import { STALL_MIN_MS, STALL_LOG_MS, STALL_REPEAT_MS, heartbeatPlan, startHeartbeatWorker } from '../../scripts/reconciler/heartbeat-worker.mjs';
import { Engine, safeForStart } from '../../scripts/reconciler/engine.mjs';
import { engineIsSafe, engineItems, safeShadowOf } from '../../scripts/reconciler/start.mjs';
import { processListAsync } from '../../scripts/api/process/process-list-async.mjs';
import { tempState } from '../../scripts/reconciler/testing.mjs';

const NUMBERS = { pollMs: 2000, leaseMs: 30000, renewMs: 10000, heartbeatStaleMs: 60000, statusCacheMs: 20000, backoff: { minMs: 1000, maxMs: 300000 }, crashLoop: { max: 3, windowMs: 1800000 } };
const noLock = () => ({ ok: true, release() {} });

test('heartbeatPlan: the worker renews at every due tick until the stall limit, then withholds', () => {
  assert.deepEqual(heartbeatPlan({ stallMs: 0, leader: true }), { renew: true, log: false, withheld: false }, 'a live main thread is renewed for too');
  assert.equal(heartbeatPlan({ stallMs: 0, leader: true, renewDue: false }).renew, false);
  assert.equal(heartbeatPlan({ stallMs: STALL_MIN_MS, leader: true }).renew, true);
  assert.equal(heartbeatPlan({ stallMs: STALL_MIN_MS, leader: false }).renew, false, 'a non-leader renews nothing');
  assert.equal(heartbeatPlan({ stallMs: STALL_LOG_MS, leader: true }).log, true);
  assert.equal(heartbeatPlan({ stallMs: STALL_LOG_MS + 1000, leader: true, loggedAt: 0, sinceMs: STALL_LOG_MS }).log, false, 'one row per stall until the repeat period');
  assert.equal(heartbeatPlan({ stallMs: STALL_LOG_MS + STALL_REPEAT_MS, leader: true, loggedAt: 0, sinceMs: STALL_REPEAT_MS }).log, true);
  const past = heartbeatPlan({ stallMs: 300_000, leader: true, stallMaxMs: 300_000 });
  assert.equal(past.renew, false, 'a really hung engine must go stale so boot ensure replaces it');
  assert.equal(past.withheld, true);
});

test('the heartbeat worker renews the lease and the process heartbeat while the main thread is blocked', async (t) => {
  const st = tempState();
  let assist = null, engine = null;
  // one ordered cleanup: the worker and the engine close their SQLite files before the directory goes (Windows keeps them open)
  t.after(async () => { await assist?.stop(); engine?.close({ releaseLead: false }); st.close(); });
  engine = new Engine({ env: st.env, numbers: NUMBERS, config: () => ({ enabled: true, controllers: {} }), ledgers: [], controllers: [], stateOptions: { file: st.file },
    holder: 'host:1:a', claimLock: noLock, writeLog: () => {}, print: () => {} });
  const runId = engine.state.startProcessRun({ role: 'engine', startReason: 'manual' });
  engine.processRunId = runId;
  assert.equal(engine.acquire().ok, true);
  const before = engine.state.leaderOf('reconciler');
  const beforeRun = engine.state.db.prepare('SELECT last_heartbeat_at FROM process_runs WHERE run_id=?').get(runId).last_heartbeat_at;
  assist = startHeartbeatWorker({ file: st.file, leaseMs: NUMBERS.leaseMs, renewMs: 1000, env: st.env });
  assert.equal(assist.active, true);
  assist.notify({ leader: true, epoch: engine.epoch, holder: engine.holder, runId, draining: false });
  assist.phase('spec block');
  await new Promise((r) => setTimeout(r, 300)); // the worker has the state before the main thread blocks
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 7000); // a synchronous duty: no timer of this thread fires for 7 s
  const after = engine.state.leaderOf('reconciler');
  assert.ok(after.heartbeat_at > before.heartbeat_at, 'engine_leader.heartbeat_at moved while the main thread was blocked');
  assert.ok(after.expires_at > before.expires_at, 'the lease was extended');
  assert.equal(after.epoch, before.epoch);
  const afterRun = engine.state.db.prepare('SELECT last_heartbeat_at FROM process_runs WHERE run_id=?').get(runId).last_heartbeat_at;
  assert.ok(afterRun > beforeRun, 'process_runs.last_heartbeat_at moved too');
});

test('safeForStart: --safe is inherited by a fresh start only; a self-reload re-evaluates the crash-loop plan', () => {
  const at = 10_000_000;
  const record = (starts) => () => ({ starts, alertedAt: null });
  const numbers = NUMBERS;
  assert.equal(safeForStart({ argv: ['--safe'], reloaded: false, numbers, now: at }).safe, true, 'boot ensure decided it');
  assert.equal(safeForStart({ argv: [], reloaded: false, numbers, now: at }).safe, false);
  const calm = safeForStart({ argv: ['--safe'], reloaded: true, numbers, now: at, record: record([at - 1000]) });
  assert.equal(calm.safe, false, 'one abnormal start is not a crash loop: the reload leaves safe mode');
  assert.equal(calm.inherited, true);
  assert.equal(calm.reevaluated, true);
  const loop = safeForStart({ argv: ['--safe'], reloaded: true, numbers, now: at, record: record([at - 3000, at - 2000, at - 1000]) });
  assert.equal(loop.safe, true, 'a real crash loop keeps it safe');
  assert.equal(loop.starts, 3);
  assert.equal(safeForStart({ argv: [], reloaded: true, numbers, now: at, record: record([at - 3000, at - 2000, at - 1000]) }).safe, true, 'and a normal engine that reloads into a crash loop becomes safe');
  assert.equal(safeForStart({ argv: ['--safe'], reloaded: true, numbers, now: at, record: () => { throw new Error('unreadable'); } }).safe, true, 'an unreadable record keeps what it had');
});

test('start.mjs reads safe mode from the live state: a self-reload run that forces controllers shadow is RED', () => {
  const modes = (eff) => ({ job: { configured: 'active', effective: eff }, host: { configured: 'active', effective: eff }, gc: { configured: 'shadow', effective: 'shadow' },
    resource: { configured: 'active', effective: eff }, workflow: { configured: 'active', effective: eff }, fleet: { configured: 'shadow', effective: 'shadow' }, learning: { configured: 'shadow', effective: 'shadow' } });
  const leader = { fresh: true, ageMs: 1000, holder: 'h', pid: 1, epoch: 18, safe: false, startReason: 'self-reload' };
  const s = { leader, modes: modes('shadow'), violations: { open: 0 } };
  assert.deepEqual(safeShadowOf(s), ['job', 'host', 'resource', 'workflow']);
  assert.equal(engineIsSafe(s), true, 'the start reason says self-reload, the modes say safe');
  const row = engineItems(s).find((i) => i.id === 'safe-mode');
  assert.equal(row.status, 'red');
  assert.match(row.detail, /configured active but running shadow: job, host, resource, workflow/);
  assert.equal(engineIsSafe({ leader, modes: modes('active') }), false);
  assert.equal(engineIsSafe({ leader: { ...leader, safe: true }, modes: modes('active') }), true, 'controller_modes reason safe mode (leaderState.safe)');
  assert.deepEqual(safeShadowOf({ leader: { ...leader, fresh: false }, modes: modes('shadow') }), [], 'a stale engine is reported as stale, not as safe');
});

test('processListAsync reads the table without blocking: rows parsed, a failed read is null', async () => {
  const seen = [];
  const rows = await processListAsync({ platform: 'win32', cpu: true, run: async (cmd, args) => { seen.push(cmd); return { status: 0, stdout: JSON.stringify([{ pid: 4, ppid: 0, name: 'System', cmd: '', cpu: 1.5 }, { pid: 9, ppid: 4, name: 'node.exe', cmd: 'node x.mjs' }]) }; } });
  assert.deepEqual(seen, ['powershell.exe']);
  assert.deepEqual(rows.map((r) => r.pid), [4, 9]);
  assert.equal(rows[1].cmd, 'node x.mjs');
  assert.equal((await processListAsync({ platform: 'win32', match: /x\.mjs/, run: async () => ({ status: 0, stdout: JSON.stringify({ pid: 9, ppid: 4, name: 'node.exe', cmd: 'node x.mjs' }) }) })).length, 1);
  assert.equal(await processListAsync({ platform: 'win32', run: async () => ({ status: 1, stdout: '' }) }), null);
  assert.equal(await processListAsync({ platform: 'win32', run: async () => { throw new Error('boom'); } }), null);
});

test('leaderState reads the live leader and safe mode from machine.sqlite (mode_changes reason of the current mode)', async (t) => {
  const { leaderState } = await import('../../scripts/reconciler/boot.mjs');
  const st = tempState();
  t.after(() => st.close());
  st.m.acquireLeader({ name: 'reconciler', holder: 'h:1:a', pid: 1, leaseMs: 30000 });
  const at = () => leaderState({ env: st.env, numbers: NUMBERS });
  assert.equal(at().holder, 'h:1:a', 'the reader answers (a bad column made the whole read null)');
  assert.equal(at().fresh, true);
  assert.deepEqual(at().safeModes, []);
  st.m.setControllerMode({ controller: 'job', mode: 'active', by: 'engine:h', reason: 'config.yaml reconciler.controllers.job.mode' });
  st.m.setControllerMode({ controller: 'job', mode: 'shadow', by: 'engine:h', reason: 'safe mode: configured active runs shadow' });
  st.m.setControllerMode({ controller: 'host', mode: 'active', by: 'engine:h', reason: 'config.yaml reconciler.controllers.host.mode' });
  assert.deepEqual(at().safeModes, ['job']);
  assert.equal(at().safe, true);
  st.m.setControllerMode({ controller: 'job', mode: 'active', by: 'engine:h', reason: 'config.yaml reconciler.controllers.job.mode' });
  assert.equal(at().safe, false, 'a normal restart clears it');
});
