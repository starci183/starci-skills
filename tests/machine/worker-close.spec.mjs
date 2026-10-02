// worker-close.spec.mjs - a finished worker is closed COMPLETELY (scripts/machine/worker-close.mjs): worker-release, the terminal close and a
// bounded verify that no process of the terminal's shell tree remains. A fake Orca and a fake process table drive every case; one real-process
// case proves the environment read the membership proof rests on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { closeWorker, survivorsOf, terminalTree } from '../../scripts/machine/worker-close.mjs';
import { processEnv } from '../../scripts/api/process/process-env.mjs';

const HANDLE = 'term_worker_1';
const DISPATCH = 'ctx_worker_1';
// The terminal's shell (carries the handle), the agent under it, and a codex.exe of another application that carries no handle.
const SHELL = { pid: 100, ppid: 1, name: 'powershell.exe', created: 1000 };
const AGENT = { pid: 101, ppid: 100, name: 'cursor-agent.exe', created: 1001 };
const GRAND = { pid: 102, ppid: 101, name: 'node.exe', created: 1002 };
const OTHER_CODEX = { pid: 300, ppid: 1, name: 'codex.exe', created: 900 };
const envRows = [{ pid: 100, readable: true, values: { ORCA_TERMINAL_HANDLE: HANDLE } }, { pid: 101, readable: true, values: { ORCA_TERMINAL_HANDLE: HANDLE } },
  { pid: 300, readable: true, values: { ORCA_TERMINAL_HANDLE: null } }];

/** A world: the worker, its terminal and a process table that changes with what the runtime does. */
function world({ killWorks = true, releaseOk = true, survivors = [], envRowsOf = envRows, tableAfter = null, closeOk = true } = {}) {
  const calls = [];
  let table = [SHELL, AGENT, GRAND, OTHER_CODEX];
  const deps = {
    show: () => { calls.push('show'); return { ok: true, result: { worker: { agentTerminalHandle: HANDLE } } }; },
    stop: () => { calls.push('stop'); return { ok: true }; },
    release: () => { calls.push('release'); return releaseOk ? { ok: true, outcome: 'ok', state: 'released' } : { ok: false, outcome: 'unknown', error: 'refused' }; },
    // The release leaves the terminal and its processes alive (the cursor case); only the close ends the shell tree, but a survivor lives on.
    close: (handle) => { calls.push(`close:${handle}`); table = [...(tableAfter ?? [OTHER_CODEX]), ...survivors]; return { handle, ok: closeOk, proof: closeOk ? 'gone' : null }; },
    tableOf: () => (table === null ? null : table.map((p) => ({ ...p }))),
    envOf: () => envRowsOf,
    kill: (pid) => { calls.push(`kill:${pid}`); if (killWorks) table = table.filter((p) => p.pid !== pid && p.ppid !== pid); return { ok: killWorks }; },
    sleep: () => {}, log: (row) => calls.push(`log:${row.data?.verdict}`),
    verifyMs: 2000, pollMs: 1000, stopVerifyMs: 2000,
  };
  return { deps, calls, setTable: (t) => { table = t; } };
}

test('terminalTree: the handle-carrying processes and every descendant of them, never a process of another application', () => {
  const tree = terminalTree(HANDLE, { table: [SHELL, AGENT, GRAND, OTHER_CODEX], envRows });
  assert.deepEqual(tree.shells, [100]);
  assert.deepEqual(tree.members.map((p) => p.pid).sort(), [100, 101, 102]);
  assert.deepEqual(survivorsOf(tree.members, [{ pid: 101, created: 1001 }, { pid: 102, created: 9999 }]).map((p) => p.pid), [101], 'a reused pid with another creation time is another process');
});

test('a release that leaves the terminal live: the runtime closes that terminal, proves it, and finds nothing of its tree left', () => {
  const w = world();
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  assert.deepEqual(w.calls.filter((c) => !c.startsWith('log')), ['show', 'release', `close:${HANDLE}`], 'release first, then the terminal close, of the worker\'s own terminal');
  assert.equal(out.closed.ok, true);
  assert.equal(out.processes.verdict, 'none');
  assert.equal(out.hygiene, null);
  assert.equal(out.ok, true);
  assert.equal(out.handle, HANDLE);
});

test('a worker stopped first: stop, release, then close, in that order', () => {
  const w = world();
  const out = closeWorker({ dispatch: DISPATCH, stopFirst: true, deps: w.deps, env: {} });
  assert.deepEqual(w.calls.filter((c) => !c.startsWith('log')), ['show', 'stop', 'release', `close:${HANDLE}`]);
  assert.equal(out.stop.ok, true);
});

test('a process of the closed terminal that survives is stopped by its pid, re-verified, and the outcome stays the release\'s', () => {
  const w = world({ survivors: [AGENT, GRAND] });
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  const kills = w.calls.filter((c) => c.startsWith('kill:'));
  assert.deepEqual(kills, ['kill:101'], 'only the root of the surviving subtree of that terminal is stopped, by pid');
  assert.equal(out.processes.verdict, 'stopped');
  assert.deepEqual(out.processes.stopped, [101]);
  assert.equal(out.hygiene, null, 'a survivor that the stop ended raises no finding');
  assert.equal(out.ok, true);
  assert.ok(w.calls.includes('log:stopped'), 'the stop is logged');
});

test('a survivor that outlives the stop raises the host-hygiene finding worker-process-survived and never changes the outcome', () => {
  const w = world({ survivors: [AGENT], killWorks: false });
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  assert.equal(out.processes.verdict, 'survived');
  assert.equal(out.hygiene.code, 'worker-process-survived');
  assert.deepEqual(out.hygiene.survivors.map((p) => p.pid), [101]);
  assert.equal(out.ok, true, 'the worker that released ok stays released');
  assert.equal(out.state, 'released');
});

test('a same-named process outside the terminal tree is never touched, whatever its name', () => {
  // The other application's codex.exe survives the close by design (it is not the worker's): it is not in the tree, so nothing is stopped.
  const w = world({ survivors: [] });
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  assert.deepEqual(w.calls.filter((c) => c.startsWith('kill:')), []);
  assert.equal(out.processes.verdict, 'none');
  // And when the worker itself ran a codex.exe that survives, only THAT pid (inside the tree) is stopped, not the other application's.
  const inTree = { pid: 103, ppid: 100, name: 'codex.exe', created: 1003 };
  const w2 = world({ survivors: [inTree] });
  w2.deps.envOf = () => [...envRows, { pid: 103, readable: true, values: { ORCA_TERMINAL_HANDLE: HANDLE } }];
  const out2 = closeWorker({ dispatch: DISPATCH, deps: w2.deps, env: {} });
  assert.deepEqual(w2.calls.filter((c) => c.startsWith('kill:')), ['kill:103']);
  assert.equal(out2.processes.verdict, 'stopped');
});

test('verify cannot run: nothing is killed and the answer is unverifiable', () => {
  for (const [label, patch] of [['environments unreadable', { envOf: () => null }], ['process table unreadable', { tableOf: () => null }], ['no process carries the handle', { envOf: () => [] }]]) {
    const w = world({ survivors: [AGENT] });
    Object.assign(w.deps, patch);
    const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
    assert.equal(out.processes.verdict, 'unverifiable', label);
    assert.deepEqual(w.calls.filter((c) => c.startsWith('kill:')), [], `${label}: nothing is killed`);
    assert.equal(out.hygiene, null);
    assert.equal(out.ok, true);
  }
  const w = world({ survivors: [AGENT] });
  let reads = 0;
  w.deps.tableOf = () => (reads++ === 0 ? [SHELL, AGENT, GRAND] : null);
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  assert.equal(out.processes.verdict, 'unverifiable', 'a table that stops answering while verifying');
  assert.deepEqual(w.calls.filter((c) => c.startsWith('kill:')), []);
});

test('a caller inside the worker\'s own terminal releases it but does not close or verify it from there', () => {
  const w = world();
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: { ORCA_TERMINAL_HANDLE: HANDLE } });
  assert.deepEqual(w.calls.filter((c) => !c.startsWith('log')), ['show', 'release']);
  assert.equal(out.processes.verdict, 'not-checked');
  assert.equal(out.closed, null);
});

test('a release that is refused is repeated once on request and the receipt of the last attempt is the answer', () => {
  const w = world({ releaseOk: false });
  const out = closeWorker({ dispatch: DISPATCH, retryRelease: true, deps: w.deps, env: {} });
  assert.equal(w.calls.filter((c) => c === 'release').length, 2);
  assert.equal(out.ok, false);
  assert.equal(out.retryRelease.ok, false);
});

test('processEnv reads the environment of a real process: the handle a child inherited proves its terminal', { skip: process.platform === 'win32' || process.platform === 'linux' ? false : 'only Windows and Linux can read another process\'s environment' }, async (t) => {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { env: { ...process.env, ORCA_TERMINAL_HANDLE: 'term_spec_probe' }, stdio: 'ignore', windowsHide: true });
  t.after(() => child.kill());
  await new Promise((resolve) => setTimeout(resolve, 400));
  const rows = processEnv({ names: ['ORCA_TERMINAL_HANDLE'], pids: [child.pid, process.pid] });
  assert.ok(Array.isArray(rows), 'the environments could be read');
  const row = rows.find((r) => r.pid === child.pid);
  assert.equal(row.readable, true);
  assert.equal(row.values.ORCA_TERMINAL_HANDLE, 'term_spec_probe');
  assert.equal(rows.find((r) => r.pid === process.pid).values.ORCA_TERMINAL_HANDLE ?? null, process.env.ORCA_TERMINAL_HANDLE ?? null);
});
