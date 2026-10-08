// A release Orca cannot confirm is moot once the terminal is positively gone and no process carries its handle. Live shape
// (2026-10-08, after the reboot): the old Dispatch of a replaced Kernel was failed by Orca's recovery, `worker-release` answered
// no confirmation, the terminal was gone and the census empty, and `workflow start` was refused kernel-stale-terminal-unclosed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { closeWorker, stopAndRelease, workerClosureProven } from '../../scripts/machine/worker-close.mjs';

const HANDLE = 'term_458f0ba5-ec3d-456c-80e5-0fdbdca79d1f', DISPATCH = 'ctx_1547c436a86c';
const UNCONFIRMED = { ok: false, outcome: 'unknown', state: 'release_unknown', error: null };
const deps = ({ release = UNCONFIRMED, close = { handle: HANDLE, ok: true, proof: 'gone', attempts: 0, before: 'gone' }, table = [], envRows = [] } = {}) => ({
  show: () => ({ ok: true, result: { worker: { agentTerminalHandle: HANDLE } } }), stop: () => ({ ok: true }), release: () => release,
  close: () => close, tableOf: () => table, envOf: () => envRows, capture: () => null, stopProcess: () => null, sleep: () => {}, log: () => {},
  releaseBudget: () => ({ ok: true, released: 0 }), verifyMs: 10, pollMs: 5, stopVerifyMs: 10 });

test('the exact post-reboot shape: gone terminal, empty census, unconfirmed release -> the closure is ok and says why', () => {
  const closed = stopAndRelease(DISPATCH, { handle: HANDLE, env: {}, deps: deps() });
  assert.equal(closed.ok, true);
  assert.equal(closed.release.released, 'moot-terminal-gone');
  assert.deepEqual([closed.closed.proof, closed.processes.verdict], ['gone', 'none']);
  assert.equal(workerClosureProven({ ...closed, handle: HANDLE }, HANDLE), true, 'every closure judge reads the same receipt');
});

test('a stale handle or an unknown Dispatch answer is just as moot', () => {
  for (const error of ['dispatch_not_found: Worker Dispatch ctx_1547c436a86c was not found.', 'terminal_handle_stale: the handle is stale']) {
    assert.equal(closeWorker({ dispatch: DISPATCH, handle: HANDLE, env: {}, deps: deps({ release: { ok: false, error } }) }).ok, true, error);
  }
});

test('an Orca outage keeps the closure unproven', () => {
  const down = { ok: false, outcome: 'unknown', hostUnavailable: true, error: 'orca unreachable' };
  assert.equal(closeWorker({ dispatch: DISPATCH, handle: HANDLE, env: {}, deps: deps({ release: down, close: { handle: HANDLE, ok: false, proof: null, reason: 'host-unavailable' } }) }).ok, false);
  assert.equal(closeWorker({ dispatch: DISPATCH, handle: HANDLE, env: {}, deps: deps({ release: down }) }).ok, false, 'a release that could not reach Orca is not unconfirmed');
});

test('a terminal that was listed or connected before the close keeps the closure unproven', () => {
  for (const before of ['connected', undefined]) {
    assert.equal(closeWorker({ dispatch: DISPATCH, handle: HANDLE, env: {}, deps: deps({ close: { handle: HANDLE, ok: true, proof: 'gone', before } }) }).ok, false, String(before));
  }
});

test('an unreadable or non-empty census keeps the closure unproven', () => {
  assert.equal(closeWorker({ dispatch: DISPATCH, handle: HANDLE, env: {}, deps: { ...deps(), tableOf: () => null } }).ok, false);
  const alive = [{ pid: 7, ppid: 1, name: 'codex.exe', exe: 'x', created: 5 }];
  const tagged = [{ pid: 7, readable: true, values: { ORCA_TERMINAL_HANDLE: HANDLE } }];
  assert.equal(closeWorker({ dispatch: DISPATCH, handle: HANDLE, env: {}, deps: deps({ table: alive, envRows: tagged }) }).ok, false);
});

test('a release refused for another reason stays refused', () => {
  assert.equal(closeWorker({ dispatch: DISPATCH, handle: HANDLE, env: {}, deps: deps({ release: { ok: false, outcome: 'failed', error: 'permission denied' } }) }).ok, false);
});
