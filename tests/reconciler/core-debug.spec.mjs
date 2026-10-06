import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureCoreDebug, coreDebugProfile, coreDebugRoute, coreDebugStatus, watchCoreDebug, stopCoreDebug } from '../../scripts/reconciler/core-debug.mjs';
import { openMachine, pidAlive } from '../../engine/db/machine.mjs';
import { writeSeat, setEnabled, seatOf, SUPERVISOR_SEAT, SKILL_ROOT, supervisedSeatHandles } from '../../scripts/machine/home.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';

const config = { debug: true, language: 'vi', effort: 'high', coreDebug: { interval: '90s', worktreeLimit: 3 } };
const caller = { agent: 'codex', model: 'gpt-6.1-sol', effort: 'high' };
const t0 = Date.UTC(2026, 9, 3, 20);
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-seat-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, env: { STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite'), STARCI_LOCAL_ROOT: root } };
}
function host({ fail = null } = {}) {
  const calls = { start: [], stop: [], release: [] }, workers = new Map();
  const h = {
    calls, workers, admission: fakeAdmission(),
    list: () => ({ ok: true, terminals: [{ handle: 'entry', connected: true, writable: true, worktreePath: SKILL_ROOT }] }),
    tabTitles: () => new Map(), screen: () => '> ', exitedRow: () => null,
    close: () => ({ ok: true }), quit: () => ({ exited: true }), bindSeat: () => 'guard-receipt',
    show: dispatch => workers.has(dispatch) ? { ok: true, state: workers.get(dispatch) } : { ok: false, error: 'unavailable worker evidence' },
    stop: dispatch => { calls.stop.push(dispatch); workers.set(dispatch, 'stopped'); return { ok: true }; },
    release: (dispatch, handle) => { calls.release.push(dispatch); return { ok: true, handle, closed: { ok: true, proof: 'gone' }, processes: { verdict: 'none' } }; },
    start: input => {
      calls.start.push(input);
      if (fail) return { ok: false, step: 'worker-start', error: 'test refusal', effectState: fail };
      const n = calls.start.length, dispatchId = `dispatch-${n}`, terminal = `term-${n}`;
      workers.set(dispatchId, 'running');
      return { ok: true, terminal, dispatchId, runId: 'run-debug', taskId: `task-${n}`,
        provider: input.provider, model: input.model, effective: { agent: input.provider, model: input.model } };
    },
  };
  return h;
}

test('false debug creates no store or provider effects and leaves workflow readiness green', async t => {
  const { env } = fixture(t), h = host();
  const result = await ensureCoreDebug({ caller, env, config: { ...config, debug: false }, deps: { host: h } });
  assert.deepEqual(result, { ok: true, ready: true, action: 'disabled' });
  assert.equal(fs.existsSync(env.STARCI_TEST_MACHINE_FILE), false);
  assert.equal(h.calls.start.length, 0);
});

test('caller route preserves registered concrete identity without changing any product pins', () => {
  const cfg = { ...config, kernel: { agent: 'claude', model: 'claude-sonnet-5-5' }, supervisor: { kernel: { agent: 'claude', model: 'claude-opus-5-5' } } };
  const before = structuredClone(cfg);
  assert.equal(coreDebugRoute(caller, cfg).model, caller.model);
  assert.equal(coreDebugRoute({ agent: caller.agent, model: caller.model }, cfg).effort, null,
    'an unproved invoking effort is not inferred from the generic configured tier');
  assert.equal(coreDebugRoute({ agent: 'claude', model: 'claude-opus-5-5' }, cfg).model, 'claude-opus-5-5');
  assert.throws(() => coreDebugRoute({ agent: 'codex', model: 'claude-opus-5-5' }, cfg), /not registered/);
  assert.throws(() => coreDebugRoute({}, cfg), /declared invoking agent/);
  assert.deepEqual(cfg, before);
  const opaque = coreDebugRoute({ agent: 'devin' }, cfg);
  assert.equal(opaque.match, 'logical-runtime');
  assert.equal(opaque.modelAuthority, 'configured-logical-runtime');
  assert.throws(() => coreDebugRoute({ agent: 'devin', model: 'gpt-6.1-sol' }, cfg), /not registered|cannot attest/);
});

test('a read-only plan does not fabricate native readiness or admit an economy control worker', async t => {
  const { env } = fixture(t), h = host();
  const planned = await ensureCoreDebug({ caller, env, config, plan: true, deps: { host: h } });
  assert.equal(planned.planned, true);
  assert.equal(planned.wouldLaunch, true);
  assert.equal(fs.existsSync(env.STARCI_TEST_MACHINE_FILE), false);
  assert.equal(coreDebugStatus({ env }).ready, false);
  const rejected = await ensureCoreDebug({ caller: { agent: 'codex', model: 'gpt-6-luna' }, env, config, plan: true, deps: { host: h } });
  assert.equal(rejected.wouldLaunch, false);
  assert.equal(rejected.ready, false);
  assert.equal(h.calls.start.length, 0);
});

test('native maintenance does not request a configured tier when invoking effort is absent', async t => {
  const { env } = fixture(t), h = host();
  const result = await ensureCoreDebug({ caller: { agent: caller.agent, model: caller.model }, env, config, deps: { host: h } });
  assert.equal(result.ready, true);
  assert.equal(result.requestedRoute.effort, null);
  assert.equal(h.calls.start[0].effort, null);
});

test('same caller attaches to one native maintenance seat and a conflicting caller cannot transfer it', async t => {
  const { env } = fixture(t), h = host(), deps = { host: h };
  const main = openMachine({ env });
  try { writeSeat(main, { token: 'main-token', profile: SUPERVISOR_SEAT, value: { dispatch: 'main-dispatch', terminal: 'main-terminal', agent: 'claude', model: 'claude-opus-5-5' }, now: t0 }); }
  finally { main.close(); }
  const first = await ensureCoreDebug({ caller, env, config, deps, now: () => t0 });
  assert.equal(first.action, 'booted'); assert.equal(first.ready, true);
  assert.equal(h.calls.start[0].provider, caller.agent);
  assert.deepEqual(h.calls.start[0].allowGroup.map(row => [row.provider, row.model]), [[caller.agent, caller.model]]);
  assert.equal((await ensureCoreDebug({ caller, env, config, deps })).action, 'already-live');
  const inherited = await ensureCoreDebug({ env, config, deps });
  assert.equal(inherited.action, 'already-live', 'watchdog ingress reuses an owned route without a new caller');
  assert.equal(inherited.invocationCaller, null);
  assert.equal(inherited.requestedRoute.source, 'persisted-owned-seat');
  const missingFlags = await ensureCoreDebug({ caller: { agent: null, model: null, effort: null }, env, config, deps });
  assert.equal(missingFlags.invocationCaller, null);
  assert.equal(missingFlags.action, 'already-live');
  const partialCaller = await ensureCoreDebug({ caller: { model: caller.model }, env, config, deps });
  assert.equal(partialCaller.action, 'caller-route-unavailable');
  const conflict = await ensureCoreDebug({ caller: { agent: 'claude', model: 'claude-opus-5-5' }, env, config, deps });
  assert.equal(conflict.action, 'route-conflict'); assert.equal(conflict.ready, false);
  assert.equal(h.calls.start.length, 1); assert.deepEqual(h.calls.stop, []);
  const m = openMachine({ env });
  try {
    assert.equal(seatOf(m).value.model, 'claude-opus-5-5');
    assert.deepEqual([...supervisedSeatHandles(m)].sort(), ['main-terminal', 'term-1']);
    assert.equal(m.supSignal(coreDebugProfile().enabledScope, coreDebugProfile().id).value.route.agent, 'codex');
  } finally { m.close(); }
});

test('an unknown native launch remains held across expiry and cannot be cleared by unproved stop', async t => {
  const { env } = fixture(t), h = host({ fail: 'unknown' }), deps = { host: h };
  assert.equal((await ensureCoreDebug({ caller, env, config, deps, now: () => t0 })).ready, false);
  assert.equal((await ensureCoreDebug({ caller, env, config, deps, now: () => t0 + 86400_000 })).ready, false);
  assert.equal(h.calls.start.length, 1);
  const stopped = await stopCoreDebug({ env, deps });
  assert.equal(stopped.ok, false); assert.equal(stopped.action, 'stop-unproven');
  const m = openMachine({ env });
  try { assert.equal(seatOf(m, t0 + 86400_000, coreDebugProfile()).value.state, 'launch-unknown'); }
  finally { m.close(); }
});

test('failed-before-launch retries the same persisted route and a successful stop closes only its worker', async t => {
  const { env } = fixture(t), failed = host({ fail: 'none' });
  assert.equal((await ensureCoreDebug({ caller, env, config, deps: { host: failed } })).ready, false);
  const h = host();
  const repaired = await watchCoreDebug({ env, config, deps: { host: h, show: h.show } });
  assert.equal(repaired.action, 'booted'); assert.equal(h.calls.start[0].model, caller.model);
  assert.equal((await stopCoreDebug({ env, deps: { host: h } })).ok, true);
  assert.deepEqual(h.calls.stop, ['dispatch-1']);
  assert.deepEqual(h.calls.release, ['dispatch-1']);
  assert.equal(coreDebugStatus({ env, deps: { show: h.show } }).ready, false);
});

test('refused worker-show does not prove death or permit a destructive replacement', async t => {
  const { env } = fixture(t), h = host();
  await ensureCoreDebug({ caller, env, config, deps: { host: h } });
  const refusal = () => ({ ok: false, hostUnavailable: false, error: 'host-contract-drift' });
  const result = await watchCoreDebug({ env, config, deps: { host: h, show: refusal } });
  assert.equal(result.ok, false); assert.equal(result.action, 'host-unavailable');
  assert.equal(h.calls.start.length, 1); assert.deepEqual(h.calls.stop, []); assert.deepEqual(h.calls.release, []);
  assert.equal(coreDebugStatus({ env, deps: { show: refusal } }).ready, false);
});

test('an absent invoker cannot revive a dead seat while the Host may repair its persisted owned route', async t => {
  const { env } = fixture(t), h = host(), deps = { host: h, show: h.show };
  await ensureCoreDebug({ caller, env, config, deps });
  h.workers.set('dispatch-1', 'released');
  const absent = await ensureCoreDebug({ env, config, deps });
  assert.equal(absent.action, 'caller-route-unavailable');
  assert.equal(absent.ready, false);
  assert.equal(h.calls.start.length, 1); assert.deepEqual(h.calls.stop, []);
  const repaired = await watchCoreDebug({ env, config, deps });
  assert.equal(repaired.action, 'restarted');
  assert.equal(repaired.ready, true);
  assert.equal(h.calls.start[1].provider, caller.agent);
  assert.equal(h.calls.start[1].model, caller.model);
  assert.deepEqual(h.calls.stop, ['dispatch-1']);
});

test('absent-caller attachment stays read-only if a later worker observation would report death', async t => {
  const { env } = fixture(t), h = host();
  await ensureCoreDebug({ caller, env, config, deps: { host: h } });
  let reads = 0, launches = 0;
  const show = () => ({ ok: true, state: ++reads === 1 ? 'running' : 'released' });
  const result = await ensureCoreDebug({ env, config, deps: { host: { ...h, show }, show,
    launch: () => { launches += 1; throw new Error('absent caller must not launch'); } } });
  assert.equal(result.ready, true);
  assert.equal(result.invocationCaller, null);
  assert.equal(result.requestedRoute.source, 'persisted-owned-seat');
  assert.equal(reads, 1); assert.equal(launches, 0);
  assert.equal(h.calls.start.length, 1);
  assert.deepEqual(h.calls.stop, []); assert.deepEqual(h.calls.release, []);
});

test('a competing start is fenced by the native seat lock without claiming operational readiness', async t => {
  const { env } = fixture(t), h = host(), m = openMachine({ env });
  try {
    const name = `${coreDebugProfile().seatId}-start`, holderPid = process.ppid;
    assert.notEqual(holderPid, process.pid);
    assert.equal(pidAlive(holderPid), true, 'the native test runner is a live, distinct competing owner');
    assert.equal(m.acquireHostLock({ name, pid: holderPid, holder: 'other-launcher', ttlMs: 60_000 }).ok, true);
    const held = m.hostLock(name);
    assert.equal(held.holder_pid, holderPid);
    assert.ok(held.expires_at > Date.now(), 'both lock handles use the current native clock');
    const result = await ensureCoreDebug({ caller, env, config, deps: { host: h } });
    assert.equal(result.action, 'start-in-progress');
    assert.equal(result.holder, holderPid);
    assert.equal(result.ok, false);
    assert.equal(result.ready, false);
    assert.equal(h.calls.start.length, 0);
    assert.deepEqual(h.calls.stop, []); assert.deepEqual(h.calls.release, []);
    assert.deepEqual(m.hostLock(name), held, 'a refused launcher neither renews nor releases the competing owner lock');
    assert.equal(seatOf(m, Date.now(), coreDebugProfile()), null);
    assert.equal(m.supSignal(coreDebugProfile().enabledScope, coreDebugProfile().id), null);
  } finally { m.close(); }
});

test('host cadence survives process handles, wakes the bound Dispatch once and retains a busy worker', async t => {
  const { env } = fixture(t), h = host();
  await ensureCoreDebug({ caller, env, config, deps: { host: h } });
  const wakes = [], deps = { host: h, show: h.show, wake: (terminal, text) => { wakes.push([terminal, text]); return { delivered: false, action: 'kernel-busy' }; } };
  assert.equal((await watchCoreDebug({ env, config, deps, now: () => t0 })).action, 'busy');
  assert.equal((await watchCoreDebug({ env, config, deps, now: () => t0 + 1 })).action, 'fresh');
  assert.equal((await watchCoreDebug({ env, config, deps, now: () => t0 + 90_000 })).action, 'busy');
  assert.deepEqual(wakes.map(row => row[0]), ['term-1', 'term-1']);
  assert.deepEqual(h.calls.stop, []);
});
