import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLAIM_TTL_MS, LOOP_GRACE_MS, intervalMs, loadState, loopLive, runPass, setupLoop, settleFix, statePath } from '../scripts/supervisor/debug-pass.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'core-watch-snapshot.json');
const SNAP = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const T0 = Date.UTC(2026, 9, 1, 3, 10);
const empty = () => ({ loop: null, fixes: {} });

test('setup creates exactly one loop; a second setup creates none', () => {
  const state = empty();
  const started = [];
  const first = setupLoop(state, { now: T0, interval: '10m', startLoop: (l) => started.push(l.id) });
  const second = setupLoop(state, { now: T0 + 60_000, interval: '10m', startLoop: (l) => started.push(l.id) });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.loop.id, first.loop.id);
  assert.deepEqual(started, [first.loop.id]);
});

test('a loop that stopped passing is stale and the next setup replaces it; a passing loop stays live', () => {
  const state = empty();
  const { loop } = setupLoop(state, { now: T0, interval: '10m' });
  const deadline = T0 + 2 * loop.intervalMs + LOOP_GRACE_MS;
  assert.equal(loopLive(loop, deadline), true);
  assert.equal(loopLive(loop, deadline + 1), false);
  runPass(state, { alerts: [] }, { now: deadline, dispatch: () => null });
  assert.equal(loopLive(state.loop, deadline + 1), true, 'a pass keeps the loop live');
  const later = deadline + 2 * loop.intervalMs + LOOP_GRACE_MS + 1;
  const again = setupLoop(state, { now: later, interval: '10m' });
  assert.equal(again.created, true);
  assert.equal(again.replaced.id, loop.id);
  assert.throws(() => setupLoop(empty(), { now: T0, interval: 'soon' }), /bad --interval/);
  assert.equal(intervalMs('90s'), 90_000);
});

test('a pass dispatches each alert of the recorded snapshot exactly once', () => {
  const state = empty();
  const calls = [];
  const { dispatched, rows } = runPass(state, SNAP, { now: T0, dispatch: (a) => { calls.push(a.key); return a.key === 'engine' ? { lane: 'fix-engine' } : null; } });
  assert.deepEqual(calls, SNAP.alerts.map((a) => a.key));
  assert.equal(dispatched.length, 3);
  assert.equal(state.fixes.engine.state, 'fixing');
  assert.equal(state.fixes['service:harness-tunnel'].state, 'dispatching');
  assert.deepEqual(rows.map((r) => r.state), ['fixing', 'dispatching', 'dispatching']);
});

test('a second pass with the same alerts dispatches nothing new, even when the alert text changed', () => {
  const state = empty();
  runPass(state, SNAP, { now: T0, dispatch: () => null });
  const changed = { ...SNAP, alerts: SNAP.alerts.map((a) => (a.key === 'engine' ? { ...a, text: 'leader STALE heartbeat 812s' } : a)) };
  const calls = [];
  const second = runPass(state, changed, { now: T0 + 600_000, dispatch: (a) => { calls.push(a.key); return null; } });
  assert.deepEqual(calls, []);
  assert.deepEqual(second.dispatched, []);
  assert.equal(state.fixes.engine.text, 'leader STALE heartbeat 812s');
});

test('a cleared alert closes its fix; an unclaimed reservation past the TTL is dispatched again; claim and note bind it', () => {
  const state = empty();
  runPass(state, SNAP, { now: T0, dispatch: () => null });
  settleFix(state, 'engine', { now: T0, lane: 'fix-engine' });
  settleFix(state, 'wf:nivo:auth-login:leg:impl.login:job-7', { now: T0, reason: 'workflow evidence only' });
  assert.throws(() => settleFix(state, 'service:nope', { now: T0, lane: 'x' }), /no open alert/);
  const later = T0 + CLAIM_TTL_MS + 1;
  const calls = [];
  const { rows } = runPass(state, { alerts: SNAP.alerts.slice(1) }, { now: later, dispatch: (a) => { calls.push(a.key); return null; } });
  assert.deepEqual(calls, ['service:harness-tunnel'], 'only the unclaimed reservation is dispatched again');
  assert.equal(rows.find((r) => r.key === 'engine').state, 'resolved');
  assert.equal(state.fixes.engine, undefined);
  assert.equal(state.fixes['wf:nivo:auth-login:leg:impl.login:job-7'].state, 'noted');
  assert.deepEqual(settleFix(state, 'service:harness-tunnel', { now: later, release: true }), { key: 'service:harness-tunnel', released: true });
});

test('CLI: setup twice records one loop; pass twice over the recorded snapshot dispatches once, in a temp state root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-pass-'));
  const env = { ...process.env, STARCI_LOCAL_ROOT: root };
  const run = (...args) => JSON.parse(execFileSync(process.execPath, ['scripts/supervisor/debug-pass.mjs', ...args], { cwd: ROOT, env, encoding: 'utf8' }));
  try {
    assert.equal(run('setup', '--interval', '10m').created, true);
    assert.equal(run('setup').created, false);
    const first = run('pass', '--snapshot', FIXTURE);
    assert.equal(first.dispatched.length, 3);
    assert.equal(first.loop, loadState(statePath(env)).loop.id);
    assert.deepEqual(run('pass', '--snapshot', FIXTURE).dispatched, []);
    assert.equal(run('claim', '--key', 'engine', '--lane', 'fix-engine').state, 'fixing');
    assert.equal(run('stop').stopped !== null, true);
    assert.equal(run('status').loop, null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
