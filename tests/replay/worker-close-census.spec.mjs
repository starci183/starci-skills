// Replay the native partial environment census: stale terminal observations cannot erase unknown process custody.
import test from 'node:test';
import assert from 'node:assert/strict';
import { closeWorker, workerClosureProven } from '../../scripts/machine/worker-close.mjs';
import { workerCloseVerb } from '../../scripts/supervisor/worker-verbs-close.mjs';
import { OWNED_PROCESS_SCHEMA } from '../../scripts/lib/process-identity.mjs';

const HANDLE = 'term-census', DISPATCH = 'ctx-census';
const row = { pid: 17, ppid: 1, name: 'shell', exe: 'shell', created: 1000 };
const foreign = { ...row, pid: 19, name: 'foreign', exe: 'foreign' };
const observation = (pid, value = null) => ({ pid, readable: true, values: { ORCA_TERMINAL_HANDLE: value } });
const identity = { pid: row.pid, birth: '116444736010000000', exe: row.exe };

/** Exercise the real close owner and public verdict with recorded native observations; only external tool boundaries are stubbed. */
function censusWorld({ initialTable = [], initialEnv = [], afterTable = initialTable, afterEnv = initialEnv, captured = false,
  released = false, afterStopEnv = null } = {}) {
  const effects = [];
  let closed = false, stopped = false;
  const deps = {
    show: () => ({ ok: true, result: { worker: { agentTerminalHandle: HANDLE } } }),
    release: () => { effects.push('release'); return released ? { ok: true, state: 'released' } : { ok: false, state: 'release_unknown' }; },
    stop: () => { effects.push('stop'); return { ok: true }; },
    close: handle => { effects.push('close'); closed = true; return { handle, ok: true, before: 'gone', proof: 'gone' }; },
    tableOf: () => stopped ? [foreign] : closed ? afterTable : initialTable,
    envOf: () => stopped ? afterStopEnv : closed ? afterEnv : initialEnv,
    capture: pid => { effects.push('capture'); return captured ? { schema: OWNED_PROCESS_SCHEMA, pid, ok: true,
      outcome: 'captured', proof: 'process-handle-live', identity } : null; },
    stopProcess: value => { effects.push('stop-process'); stopped = true; return { schema: OWNED_PROCESS_SCHEMA,
      pid: value.pid, identity: value, ok: true, outcome: 'stopped', proof: 'process-handle-signaled' }; },
    releaseBudget: () => { effects.push('budget'); return { ok: true, released: 1 }; },
    sleep: () => {}, log: () => {}, verifyMs: 10, stopVerifyMs: 10, pollMs: 5,
  };
  return { deps, effects };
}

test('partial initial census cannot close or stop a terminal or turn an unconfirmed release moot', async () => {
  for (const initialEnv of [
    [{ pid: foreign.pid, readable: false, values: { ORCA_TERMINAL_HANDLE: null } }],
    [], [observation(foreign.pid), observation(foreign.pid)],
    [{ pid: foreign.pid, readable: true, values: {} }],
  ]) {
    const world = censusWorld({ initialTable: [foreign], initialEnv, afterTable: [], afterEnv: [] });
    const receipt = closeWorker({ dispatch: DISPATCH, stopFirst: true, deps: world.deps, env: {} });
    assert.equal(receipt.processes.verdict, 'unverifiable');
    assert.equal(receipt.released, undefined);
    assert.equal(workerClosureProven(receipt, HANDLE), false);
    assert.deepEqual(world.effects, ['release'], 'unknown custody permits no close, stop, capture or budget effect');
    const verdict = await workerCloseVerb({ args: { dispatch: DISPATCH }, env: {} }, { closeWorker: () => receipt });
    assert.equal(verdict.code, 1);
    assert.equal(verdict.data.processGone, false);
  }
});

test('a complete empty initial census cannot become empty proof when post-close coverage is partial', () => {
  for (const afterEnv of [[], [{ pid: foreign.pid, readable: false, values: { ORCA_TERMINAL_HANDLE: null } }]]) {
    const world = censusWorld({ afterTable: [foreign], afterEnv });
    const receipt = closeWorker({ dispatch: DISPATCH, deps: world.deps, env: {} });
    assert.equal(receipt.processes.verdict, 'unverifiable');
    assert.equal(receipt.ok, false);
    assert.equal(workerClosureProven(receipt, HANDLE), false);
    assert.deepEqual(world.effects, ['release', 'close']);
  }
});

test('an environment-only PID cannot authorize initial closure or certify an inconsistent later snapshot', () => {
  for (const value of [HANDLE, null]) {
    const initial = censusWorld({ initialEnv: [observation(row.pid, value)], afterTable: [], afterEnv: [] });
    const before = closeWorker({ dispatch: DISPATCH, stopFirst: true, deps: initial.deps, env: {} });
    assert.equal(before.processes.verdict, 'unverifiable');
    assert.equal(before.ok, false, 'a later empty snapshot cannot make the unconfirmed release moot');
    assert.equal(workerClosureProven(before, HANDLE), false);
    assert.deepEqual(initial.effects, ['release'], 'initial snapshot disagreement authorizes no stop or close');
    const later = censusWorld({ afterEnv: [observation(row.pid, value)] });
    const after = closeWorker({ dispatch: DISPATCH, deps: later.deps, env: {} });
    assert.equal(after.processes.verdict, 'unverifiable');
    assert.equal(after.ok, false);
    assert.equal(workerClosureProven(after, HANDLE), false);
    assert.deepEqual(later.effects, ['release', 'close']);
  }
});

test('captured objects disappearing cannot prove terminal absence through a partial later census', () => {
  for (const afterEnv of [[], [{ pid: foreign.pid, readable: false, values: { ORCA_TERMINAL_HANDLE: null } }]]) {
    const world = censusWorld({ initialTable: [row], initialEnv: [observation(row.pid, HANDLE)],
      afterTable: [foreign], afterEnv, captured: true, released: true });
    const receipt = closeWorker({ dispatch: DISPATCH, deps: world.deps, env: {} });
    assert.equal(receipt.processes.verdict, 'unverifiable');
    assert.equal(receipt.ok, true, 'release accounting remains separate from closure proof');
    assert.equal(workerClosureProven(receipt, HANDLE), false);
    assert.deepEqual(world.effects, ['capture', 'release', 'close']);
  }
});

test('even a native captured-object stop cannot certify closure with unreadable post-stop environments', () => {
  const world = censusWorld({ initialTable: [row], initialEnv: [observation(row.pid, HANDLE)],
    afterTable: [row], afterEnv: [observation(row.pid, HANDLE)], captured: true, released: true,
    afterStopEnv: [{ pid: foreign.pid, readable: false, values: { ORCA_TERMINAL_HANDLE: null } }] });
  const receipt = closeWorker({ dispatch: DISPATCH, deps: world.deps, env: {} });
  assert.equal(receipt.processes.verdict, 'unverifiable');
  assert.equal(workerClosureProven(receipt, HANDLE), false);
  assert.deepEqual(world.effects, ['capture', 'release', 'close', 'stop-process']);
});

test('readable foreign process observations preserve positive empty-terminal closure', () => {
  const world = censusWorld({ initialTable: [foreign], initialEnv: [observation(foreign.pid)] });
  const receipt = closeWorker({ dispatch: DISPATCH, deps: world.deps, env: {} });
  assert.equal(receipt.processes.verdict, 'none');
  assert.equal(receipt.released, 'moot-terminal-gone');
  assert.equal(workerClosureProven(receipt, HANDLE), true);
  assert.deepEqual(world.effects, ['release', 'close', 'budget']);
});
