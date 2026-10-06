// The existing worker closure owner binds stops to captured native objects and repeats the measured terminal census.
// OS seams drive refusal/identity races; the separate owned-process spec qualifies the actual same-handle Windows primitive.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { closeWorker, survivorsOf, terminalTree, workerClosureProven, workerExitProven } from '../../scripts/machine/worker-close.mjs';
import { processEnv } from '../../scripts/api/process/process-env.mjs';
import { OWNED_PROCESS_SCHEMA } from '../../scripts/lib/process-identity.mjs';
import { withLedger } from '../helpers/ledger-fixture.mjs';
import { winPath } from '../fixtures/win-path.mjs';

const HANDLE = 'term_worker_1';
const DISPATCH = 'ctx_worker_1';
// The terminal's shell (carries the handle), the agent under it, and a codex.exe of another application that carries no handle.
const SHELL = { pid: 100, ppid: 1, name: 'powershell.exe', exe: winPath('C', 'fixture', 'powershell.exe'), created: 1000 };
const AGENT = { pid: 101, ppid: 100, name: 'cursor-agent.exe', exe: winPath('C', 'fixture', 'cursor-agent.exe'), created: 1001 };
const GRAND = { pid: 102, ppid: 101, name: 'node.exe', exe: winPath('C', 'fixture', 'node.exe'), created: 1002 };
const OTHER_CODEX = { pid: 300, ppid: 1, name: 'codex.exe', exe: winPath('C', 'other', 'codex.exe'), created: 900 };
const envRows = [{ pid: 100, readable: true, values: { ORCA_TERMINAL_HANDLE: HANDLE } }, { pid: 101, readable: true, values: { ORCA_TERMINAL_HANDLE: HANDLE } },
  { pid: 102, readable: true, values: { ORCA_TERMINAL_HANDLE: HANDLE } },
  { pid: 300, readable: true, values: { ORCA_TERMINAL_HANDLE: null } }];
const identityOf = row => ({ pid: row.pid, birth: (116444736000000000n + BigInt(row.created) * 10000n).toString(), exe: row.exe });
const captured = row => ({ schema: OWNED_PROCESS_SCHEMA, pid: row.pid, ok: true, outcome: 'captured', proof: 'process-handle-live', identity: identityOf(row) });

/** A world: the worker, its terminal and a process table that changes with what the runtime does. */
function world({ killWorks = true, releaseOk = true, survivors = [], envRowsOf = envRows, tableAfter = null, closeOk = true, initialTable = [SHELL, AGENT, GRAND, OTHER_CODEX] } = {}) {
  const calls = [];
  let table = initialTable;
  const deps = {
    show: () => { calls.push('show'); return { ok: true, result: { worker: { agentTerminalHandle: HANDLE } } }; },
    stop: () => { calls.push('stop'); return { ok: true }; },
    release: () => { calls.push('release'); return releaseOk ? { ok: true, outcome: 'ok', state: 'released' } : { ok: false, outcome: 'unknown', error: 'refused' }; },
    // The release leaves the terminal and its processes alive (the cursor case); only the close ends the shell tree, but a survivor lives on.
    close: (handle) => { calls.push(`close:${handle}`); table = [...(tableAfter ?? [OTHER_CODEX]), ...survivors]; return { handle, ok: closeOk, proof: closeOk ? 'gone' : null }; },
    tableOf: () => (table === null ? null : table.map((p) => ({ ...p }))),
    // A real process census contains only live table PIDs; old tags must not invent unobserved post-close processes.
    envOf: () => Array.isArray(envRowsOf) && Array.isArray(table) ? envRowsOf.filter(row => table.some(p => p.pid === row.pid)) : envRowsOf,
    capture: (pid, options) => {
      assert.deepEqual(options.ownership, { key: 'ORCA_TERMINAL_HANDLE', value: HANDLE });
      const row = table.find(p => p.pid === pid);
      return envRowsOf?.some(r => r.pid === pid && r.values?.ORCA_TERMINAL_HANDLE === HANDLE) && row ? captured(row)
        : { schema: OWNED_PROCESS_SCHEMA, pid, ok: false, outcome: 'unknown', reason: 'process-launch-custody-unverified' };
    },
    stopProcess: (identity) => {
      calls.push(`stop-process:${identity.pid}`);
      const row = table.find(p => p.pid === identity.pid);
      const same = row && JSON.stringify(identityOf(row)) === JSON.stringify(identity);
      if (killWorks && same) table = table.filter(p => p.pid !== identity.pid);
      return { schema: OWNED_PROCESS_SCHEMA, pid: identity.pid, identity, ok: Boolean(killWorks && same),
        outcome: killWorks && same ? 'stopped' : same ? 'unknown' : 'refused',
        proof: killWorks && same ? 'process-handle-signaled' : 'process-closure-unverified' };
    },
    sleep: () => {}, log: (row) => calls.push(`log:${row.data?.verdict}`),
    releaseBudget: () => ({ ok: true, released: 0 }),
    verifyMs: 2000, pollMs: 1000, stopVerifyMs: 2000,
  };
  return { deps, calls, setTable: (t) => { table = t; } };
}

test('terminalTree: the handle-carrying processes and every descendant of them, never a process of another application', () => {
  const tree = terminalTree(HANDLE, { table: [SHELL, AGENT, GRAND, OTHER_CODEX], envRows });
  assert.deepEqual(tree.shells, [100]);
  assert.deepEqual(tree.members.map((p) => p.pid).sort(), [100, 101, 102]);
  assert.deepEqual(survivorsOf(tree.members, [{ pid: 101, created: 1001 }, { pid: 102, created: 9999 }]).map((p) => p.pid), [101], 'a reused pid with another creation time is another process');
  assert.deepEqual(survivorsOf([{ ...AGENT, created: null }], [AGENT]), [], 'missing captured birth is never a wildcard');
  assert.deepEqual(survivorsOf([AGENT], [{ ...AGENT, created: null }]), [], 'missing current birth is never a wildcard');
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

test('physical exit proof keeps refused release bookkeeping separate and rejects uncertain or mismatched closure', () => {
  const w = world({ releaseOk: false });
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  assert.equal(out.ok, false);
  assert.equal(workerExitProven(out, HANDLE), true);
  assert.equal(workerClosureProven(out, HANDLE), false);
  for (const receipt of [
    { ...out, handle: 'another-terminal' },
    { ...out, closed: { ok: true, proof: null } },
    { ...out, closed: { ok: false, proof: 'gone' } },
    { ...out, processes: { verdict: 'unverifiable' } },
    { ...out, processes: { verdict: 'survived' } },
  ]) assert.equal(workerExitProven(receipt, HANDLE), false);
});

test('each surviving captured object is stopped through its original native identity, then re-censused', () => {
  const w = world({ survivors: [AGENT, GRAND] });
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  const stops = w.calls.filter((c) => c.startsWith('stop-process:'));
  assert.deepEqual(stops, ['stop-process:101', 'stop-process:102'], 'objects are stopped individually; no PID subtree is killed');
  assert.equal(out.processes.verdict, 'stopped');
  assert.deepEqual(out.processes.stopped, [101, 102]);
  assert.deepEqual(out.processes.census, []);
  assert.deepEqual(out.processes.stopReceipts.map(r => r.identity), [identityOf(AGENT), identityOf(GRAND)]);
  assert.equal(out.hygiene, null, 'a survivor that the stop ended raises no finding');
  assert.equal(out.ok, true);
  assert.ok(w.calls.includes('log:stopped'), 'the stop is logged');
});

test('unverified native stop remains unknown and never changes the release outcome or releases provider capacity', () => {
  const w = world({ survivors: [AGENT], killWorks: false });
  let releasedCapacity = 0;
  w.deps.releaseBudget = () => { releasedCapacity++; return { ok: true, released: 1 }; };
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  assert.equal(out.processes.verdict, 'unverifiable');
  assert.equal(out.hygiene, null);
  assert.deepEqual(out.processes.survivors.map((p) => p.pid), [101]);
  assert.equal(workerClosureProven(out, HANDLE), false);
  assert.equal(releasedCapacity, 0);
  assert.equal(out.ok, true, 'the worker that released ok stays released');
  assert.equal(out.state, 'released');
});

test('missing birth or executable refuses every forced stop instead of treating missing creation as a wildcard', () => {
  for (const missing of [{ created: null }, { exe: null }]) {
    const w = world({ initialTable: [SHELL, { ...AGENT, ...missing }, GRAND, OTHER_CODEX], survivors: [AGENT] });
    const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
    assert.equal(out.processes.verdict, 'unverifiable');
    assert.equal(workerClosureProven(out, HANDLE), false);
    assert.deepEqual(w.calls.filter(c => c.startsWith('stop-process:')), []);
  }
  const w = world({ survivors: [{ ...AGENT, created: null }] });
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  assert.equal(out.processes.verdict, 'unverifiable', 'missing birth in the later census cannot prove either survival or disappearance');
  assert.deepEqual(w.calls.filter(c => c.startsWith('stop-process:')), []);
});

test('foreign or incomplete native capture refuses before any survivor stop', () => {
  for (const alter of [r => ({ ...r, identity: { ...r.identity, birth: identityOf(OTHER_CODEX).birth } }),
    r => ({ ...r, identity: { ...r.identity, exe: OTHER_CODEX.exe } }), r => ({ ...r, identity: { ...r.identity, pid: OTHER_CODEX.pid } }),
    r => ({ ...r, proof: null }), r => ({ ...r, ok: false, outcome: 'unknown' })]) {
    const w = world({ survivors: [AGENT] });
    const capture = w.deps.capture;
    w.deps.capture = (pid, options) => alter(capture(pid, options));
    const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
    assert.equal(out.processes.verdict, 'unverifiable');
    assert.deepEqual(w.calls.filter(c => c.startsWith('stop-process:')), []);
  }
});

test('PID reuse between census and native stop cannot stop the new object or release its predecessor capacity', () => {
  const w = world({ survivors: [AGENT] });
  let stoppedForeign = 0, capacity = 0;
  w.deps.releaseBudget = () => { capacity++; return { ok: true, released: 1 }; };
  w.deps.stopProcess = identity => {
    assert.deepEqual(identity, identityOf(AGENT));
    const foreign = { ...AGENT, created: 7777, exe: OTHER_CODEX.exe };
    w.setTable([OTHER_CODEX, foreign]);
    // Existing native owner compares birth and executable before TerminateProcess on its same opened handle.
    const receipt = { schema: OWNED_PROCESS_SCHEMA, pid: identity.pid, identity, observedIdentity: identityOf(foreign),
      ok: false, outcome: 'refused', proof: 'process-identity-conflict' };
    if (receipt.ok) stoppedForeign++;
    return receipt;
  };
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  assert.equal(out.processes.verdict, 'unverifiable');
  assert.equal(stoppedForeign, 0);
  assert.equal(capacity, 0);
  assert.equal(workerClosureProven(out, HANDLE), false);
});

test('uncaptured later terminal process and failed post-closure census refuse without PID tree termination', () => {
  const later = { pid: 103, ppid: 101, name: 'node.exe', exe: GRAND.exe, created: 1003 };
  const w = world({ survivors: [AGENT, later] });
  let census = 0;
  w.deps.envOf = () => ++census === 1 ? envRows : [...envRows, { pid: 103, readable: true, values: { ORCA_TERMINAL_HANDLE: HANDLE } }];
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  assert.equal(out.processes.verdict, 'unverifiable');
  assert.match(out.processes.reason, /uncaptured terminal process/);
  assert.deepEqual(w.calls.filter(c => c.startsWith('stop-process:')), []);
  const w2 = world({ survivors: [AGENT] });
  let reads = 0;
  w2.deps.envOf = () => { if (++reads > 1) throw Error('census unavailable'); return envRows; };
  const out2 = closeWorker({ dispatch: DISPATCH, deps: w2.deps, env: {} });
  assert.equal(out2.processes.verdict, 'unverifiable');
  assert.deepEqual(w2.calls.filter(c => c.startsWith('stop-process:')), []);
});

test('a malformed stop receipt cannot become closure proof even when its side effect emptied the census', () => {
  const w = world({ survivors: [AGENT] });
  w.deps.stopProcess = () => { w.setTable([OTHER_CODEX]); return { ok: true, outcome: 'stopped' }; };
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  assert.equal(out.processes.verdict, 'unverifiable');
  assert.equal(workerClosureProven(out, HANDLE), false);
});

test('a same-named process outside the terminal tree is never touched, whatever its name', () => {
  // The other application's codex.exe survives the close by design (it is not the worker's): it is not in the tree, so nothing is stopped.
  const w = world({ survivors: [] });
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  assert.deepEqual(w.calls.filter((c) => c.startsWith('stop-process:')), []);
  assert.equal(out.processes.verdict, 'none');
  // And when the worker itself ran a codex.exe that survives, only THAT pid (inside the tree) is stopped, not the other application's.
  const inTree = { pid: 103, ppid: 100, name: 'codex.exe', exe: winPath('C', 'fixture', 'codex.exe'), created: 1003 };
  const w2 = world({ survivors: [inTree], initialTable: [SHELL, AGENT, GRAND, OTHER_CODEX, inTree],
    envRowsOf: [...envRows, { pid: 103, readable: true, values: { ORCA_TERMINAL_HANDLE: HANDLE } }] });
  const out2 = closeWorker({ dispatch: DISPATCH, deps: w2.deps, env: {} });
  assert.deepEqual(w2.calls.filter((c) => c.startsWith('stop-process:')), ['stop-process:103']);
  assert.equal(out2.processes.verdict, 'stopped');
});

test('verify cannot run: nothing is killed and the answer is unverifiable', () => {
  for (const [label, patch] of [['environments unreadable', { envOf: () => null }], ['process table unreadable', { tableOf: () => null }], ['no process carries the handle', { envOf: () => [] }]]) {
    const w = world({ survivors: [AGENT] });
    Object.assign(w.deps, patch);
    const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
    assert.equal(out.processes.verdict, 'unverifiable', label);
    assert.deepEqual(w.calls.filter((c) => c.startsWith('stop-process:')), [], `${label}: nothing is killed`);
    assert.equal(out.hygiene, null);
    assert.equal(out.ok, true);
  }
  const w = world({ survivors: [AGENT] });
  let reads = 0;
  w.deps.tableOf = () => (reads++ === 0 ? [SHELL, AGENT, GRAND] : null);
  const out = closeWorker({ dispatch: DISPATCH, deps: w.deps, env: {} });
  assert.equal(out.processes.verdict, 'unverifiable', 'a table that stops answering while verifying');
  assert.deepEqual(w.calls.filter((c) => c.startsWith('stop-process:')), []);
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

// A [Worker] filing its own report runs INSIDE the terminal that a close would end. Nothing is spawned for it: the close stays pending in the
// Supervisor's own state (the job keeps no proven terminalClosed, a worker-terminal-unclosed event records the pending close) and the host-side
// sweep, outside that terminal, closes it in process on its next tick (tests/supervisor/reconciler-gc.spec.mjs proves the sweep side).
test('a worker closing from inside its own terminal: the close is recorded pending, spawns nothing, and the next sweep tick closes and verifies it', async (t) => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { withMachine } = await import('../../engine/db/machine.mjs');
  const { createJob, closeWorkerTerminal, jobOf, openWorkerHandles } = await import('../../scripts/supervisor/workers.mjs');
  const { releaseSelfSafe } = await import('../../scripts/machine/worker-close.mjs');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-worker-pending-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(base, 'machine.sqlite') };
  withMachine((m) => {
  const { job } = createJob(m, { cluster: 'pending-close', title: 'pending close', files: ['scripts/a.mjs'] });
  m.db.prepare("UPDATE sup_jobs SET status='running' WHERE job_id=?").run(job.job_id);
  m.db.prepare("UPDATE sup_jobs SET payload_json=json_set(payload_json,'$.dispatch',?) WHERE job_id=?").run(DISPATCH, job.job_id);
  m.startSupAttempt({ jobId: job.job_id });
  const attempt = m.latestSupAttempt(job.job_id).attempt_id;
  m.updateSupAttempt(attempt, { terminalHandle: HANDLE });

  const own = (dispatch, handle, o) => releaseSelfSafe(dispatch, handle, { ...o, env: { ORCA_TERMINAL_HANDLE: HANDLE }, inline: () => assert.fail('never closed inline from inside the terminal') });
  const first = closeWorkerTerminal(m, { jobId: job.job_id, env: { ORCA_TERMINAL_HANDLE: HANDLE }, release: own });
  assert.deepEqual([first.ok, first.pending, first.reason], [false, true, 'the caller runs inside the worker terminal']);
  assert.equal(jobOf(m, job.job_id).payload.terminalClosed, undefined, 'the close is not recorded as done');
  assert.ok(openWorkerHandles(m).has(HANDLE), 'the terminal still counts as held, so the sweep sees it');
  const events = m.db.prepare("SELECT kind, payload_json FROM sup_events WHERE entity_id=? ORDER BY rowid").all(job.job_id);
  assert.ok(events.some((e) => e.kind === 'worker-terminal-unclosed' && JSON.parse(e.payload_json).pending === true), 'the pending close is recorded');

  // The next tick runs outside that terminal: the same close now runs in process, through closeWorker, and is recorded as proven.
  const closed = [];
  const tick = (dispatch, handle, o) => releaseSelfSafe(dispatch, handle, { ...o, env: {}, inline: (d) => { closed.push(d); return { dispatch: d, ...closeWorker({ dispatch: d, stopFirst: true, env: {}, deps: world().deps }) }; } });
  const second = closeWorkerTerminal(m, { jobId: job.job_id, env: {}, release: tick });
  assert.deepEqual(closed, [DISPATCH]);
  assert.equal(second.ok, true);
  assert.equal(jobOf(m, job.job_id).payload.terminalClosed.ok, true, 'recorded as closed once proven');
  }, { env });
});

test('Supervisor consumer retains logical release separately from unproved physical closure and held handles', async (t) => withLedger(t, async ({ machine: m }) => {
  const { createJob, closeWorkerTerminal, jobOf, openWorkerHandles } = await import('../../scripts/supervisor/workers.mjs');
  const cases = [
    r => ({ ...r, processes: { verdict: 'unverifiable', reason: 'native-stop-unknown' } }),
    r => ({ ...r, processes: undefined }),
    r => ({ dispatch: r.dispatch, handle: r.handle, ok: true, detached: true }),
    r => ({ ...r, handle: 'foreign-terminal' }),
    r => ({ ...r, dispatch: 'foreign-dispatch' }),
    r => ({ ...r, closed: { ok: true, proof: null } }),
    r => ({ ...r, processes: { verdict: 'survived' } }),
  ];
  for (const [index, alter] of cases.entries()) {
    const handle = `${HANDLE}_${index}`, dispatch = `${DISPATCH}_${index}`;
    const { job } = createJob(m, { cluster: `unknown-close-${index}`, title: 'unknown close', files: [`scripts/unknown-${index}.mjs`] });
    m.db.prepare("UPDATE sup_jobs SET status='running',payload_json=json_set(payload_json,'$.dispatch',?) WHERE job_id=?").run(dispatch, job.job_id);
    m.startSupAttempt({ jobId: job.job_id });
    const attempt = m.latestSupAttempt(job.job_id).attempt_id;
    m.updateSupAttempt(attempt, { terminalHandle: handle });
    const receipt = alter({ dispatch, handle, ok: true, closed: { handle, ok: true, proof: 'gone' }, processes: { verdict: 'none' } });
    const out = closeWorkerTerminal(m, { jobId: job.job_id, env: {}, release: () => receipt });
    assert.equal(out.ok, false, `case ${index}: release acceptance never records physical closure`);
    assert.equal(out.released, true, 'successful release bookkeeping is still visible');
    assert.equal(jobOf(m, job.job_id).payload.terminalClosed, undefined);
    assert.equal(m.latestSupAttempt(job.job_id).closed_at, null);
    assert.ok(openWorkerHandles(m).has(handle));
    const event = m.db.prepare("SELECT kind,payload_json FROM sup_events WHERE entity_id=? ORDER BY rowid DESC LIMIT 1").get(job.job_id);
    assert.equal(event.kind, 'worker-terminal-unclosed');
    assert.equal(JSON.parse(event.payload_json).released, true);
    m.db.prepare("UPDATE sup_jobs SET status='failed' WHERE job_id=?").run(job.job_id);
    assert.ok(openWorkerHandles(m).has(handle), 'logical job completion does not release physical terminal custody');
  }
}));

test('Supervisor records genuine measured managed closure once and then releases its held handle', async (t) => withLedger(t, async ({ machine: m }) => {
  const { createJob, closeWorkerTerminal, jobOf, openWorkerHandles } = await import('../../scripts/supervisor/workers.mjs');
  const { job } = createJob(m, { cluster: 'proven-close', title: 'proven close', files: ['scripts/proven-close.mjs'] });
  m.db.prepare("UPDATE sup_jobs SET status='running',payload_json=json_set(payload_json,'$.dispatch',?) WHERE job_id=?").run(DISPATCH, job.job_id);
  m.startSupAttempt({ jobId: job.job_id });
  m.updateSupAttempt(m.latestSupAttempt(job.job_id).attempt_id, { terminalHandle: HANDLE });
  let calls = 0;
  const release = dispatch => { calls++; return { dispatch, ...closeWorker({ dispatch, handle: HANDLE, env: {}, deps: world().deps }) }; };
  const now = Date.now();
  const out = closeWorkerTerminal(m, { jobId: job.job_id, env: {}, now, release });
  assert.equal(out.ok, true);
  assert.equal(out.released, true);
  assert.equal(workerClosureProven(out, HANDLE), true, 'stored consumer receipt retains the existing physical proof fields');
  assert.deepEqual(jobOf(m, job.job_id).payload.terminalClosed, out);
  assert.equal(m.latestSupAttempt(job.job_id).closed_at, now);
  assert.equal(openWorkerHandles(m).has(HANDLE), false);
  assert.equal(closeWorkerTerminal(m, { jobId: job.job_id, env: {}, release }), null);
  assert.equal(calls, 1);
  assert.equal(m.db.prepare("SELECT count(*) AS n FROM sup_events WHERE entity_id=? AND kind='worker-terminal-closed'").get(job.job_id).n, 1);
}));

test('historical thin closure flags or timestamps retain managed custody until the existing proof owner qualifies it', async (t) => withLedger(t, async ({ machine: m }) => {
  const { createJob, closeWorkerTerminal, jobOf, openWorkerHandles } = await import('../../scripts/supervisor/workers.mjs');
  const { job } = createJob(m, { cluster: 'close-flag', title: 'close flag', files: ['scripts/close-flag.mjs'] });
  m.db.prepare("UPDATE sup_jobs SET status='failed',payload_json=json_set(payload_json,'$.dispatch',?,'$.terminalClosed',json(?)) WHERE job_id=?")
    .run(DISPATCH, JSON.stringify({ handle: HANDLE, dispatch: DISPATCH, ok: true, proof: null }), job.job_id);
  m.startSupAttempt({ jobId: job.job_id });
  m.updateSupAttempt(m.latestSupAttempt(job.job_id).attempt_id, { terminalHandle: HANDLE, closedAt: Date.now() });
  assert.ok(openWorkerHandles(m).has(HANDLE));
  let calls = 0;
  const result = closeWorkerTerminal(m, { jobId: job.job_id, env: {}, release: () => {
    calls++; return { dispatch: DISPATCH, handle: HANDLE, ok: true, closed: { ok: true, proof: 'gone' }, processes: { verdict: 'unverifiable' } };
  } });
  assert.equal(calls, 1, 'a thin historical record cannot skip the physical owner');
  assert.equal(result.ok, false);
  assert.ok(openWorkerHandles(m).has(HANDLE));
  assert.equal(jobOf(m, job.job_id).payload.terminalClosed.proof, null, 'historical evidence remains available without being physical authority');
}));

test('a prior attempt closure receipt cannot release a current same-handle attempt', async (t) => withLedger(t, async ({ machine: m }) => {
  const { createJob, openWorkerHandles } = await import('../../scripts/supervisor/workers.mjs');
  const { job } = createJob(m, { cluster: 'prior-attempt-proof', title: 'prior attempt proof', files: ['scripts/prior-attempt.mjs'] });
  m.db.prepare("UPDATE sup_jobs SET status='running',payload_json=json_set(payload_json,'$.dispatch',?) WHERE job_id=?").run(DISPATCH, job.job_id);
  m.startSupAttempt({ jobId: job.job_id });
  const priorAttempt = m.latestSupAttempt(job.job_id).attempt_id;
  m.updateSupAttempt(priorAttempt, { terminalHandle: HANDLE, closedAt: Date.now() });
  const record = { handle: HANDLE, dispatch: DISPATCH, attemptId: priorAttempt, ok: true, closed: { ok: true, proof: 'gone' }, processes: { verdict: 'none' } };
  m.db.prepare("UPDATE sup_jobs SET payload_json=json_set(payload_json,'$.terminalClosed',json(?)) WHERE job_id=?").run(JSON.stringify(record), job.job_id);
  assert.equal(openWorkerHandles(m).has(HANDLE), false, 'same-attempt proven receipt releases the held projection');
  m.startSupAttempt({ jobId: job.job_id });
  m.updateSupAttempt(m.latestSupAttempt(job.job_id).attempt_id, { terminalHandle: HANDLE });
  assert.ok(openWorkerHandles(m).has(HANDLE), 'prior-attempt proof cannot clear a newer attempt, even when terminal and dispatch strings are the same');
}));

test('terminal-only detached verifier acceptance stays held; same-handle existing close proof qualifies once', async (t) => withLedger(t, async ({ machine: m }) => {
  const { createJob, closeWorkerTerminal, jobOf, openWorkerHandles } = await import('../../scripts/supervisor/workers.mjs');
  const { closeSelfSafe } = await import('../../scripts/machine/close-verify.mjs');
  const { job } = createJob(m, { cluster: 'terminal-only-close', title: 'terminal only', files: ['scripts/terminal-only.mjs'] });
  m.db.prepare("UPDATE sup_jobs SET status='running' WHERE job_id=?").run(job.job_id);
  m.startSupAttempt({ jobId: job.job_id });
  m.updateSupAttempt(m.latestSupAttempt(job.job_id).attempt_id, { terminalHandle: HANDLE });
  let requests = 0;
  const requested = (handle, options) => closeSelfSafe(handle, { ...options, env: { ORCA_TERMINAL_HANDLE: handle },
    spawnFn: () => { requests++; return { pid: 991, unref() {} }; } });
  const pending = closeWorkerTerminal(m, { jobId: job.job_id, env: {}, close: requested });
  assert.equal(requests, 1);
  assert.equal(pending.ok, false);
  assert.equal(pending.detached, true);
  assert.equal(jobOf(m, job.job_id).payload.terminalClosed, undefined);
  assert.equal(m.latestSupAttempt(job.job_id).closed_at, null);
  assert.ok(openWorkerHandles(m).has(HANDLE));
  assert.equal(closeWorkerTerminal(m, { jobId: job.job_id, env: {}, close: () => ({ handle: 'foreign-terminal', ok: true, proof: 'gone' }) }).ok, false);
  const closed = closeWorkerTerminal(m, { jobId: job.job_id, env: {}, close: (handle, options) => closeSelfSafe(handle, {
    ...options, env: {}, verify: exact => ({ handle: exact, ok: true, proof: 'disconnected' }) }) });
  assert.equal(closed.ok, true);
  assert.equal(openWorkerHandles(m).has(HANDLE), false);
  assert.equal(closeWorkerTerminal(m, { jobId: job.job_id, close: () => assert.fail('proven terminal-only closure is not repeated') }), null);
}));

test('a concurrent new attempt keeps its terminal and closed timestamp untouched by the previous closure', async (t) => withLedger(t, async ({ machine: m }) => {
  const { createJob, closeWorkerTerminal, jobOf, openWorkerHandles } = await import('../../scripts/supervisor/workers.mjs');
  const { job } = createJob(m, { cluster: 'changed-close-owner', title: 'changed owner', files: ['scripts/changed-owner.mjs'] });
  m.db.prepare("UPDATE sup_jobs SET status='running',payload_json=json_set(payload_json,'$.dispatch',?) WHERE job_id=?").run(DISPATCH, job.job_id);
  m.startSupAttempt({ jobId: job.job_id });
  m.updateSupAttempt(m.latestSupAttempt(job.job_id).attempt_id, { terminalHandle: HANDLE });
  const newer = 'term_newer_worker';
  const result = closeWorkerTerminal(m, { jobId: job.job_id, env: {}, release: () => {
    m.startSupAttempt({ jobId: job.job_id });
    m.updateSupAttempt(m.latestSupAttempt(job.job_id).attempt_id, { terminalHandle: newer });
    m.db.prepare("UPDATE sup_jobs SET payload_json=json_set(payload_json,'$.dispatch',?) WHERE job_id=?").run('ctx_newer_worker', job.job_id);
    return { dispatch: DISPATCH, handle: HANDLE, ok: true, closed: { ok: true, proof: 'gone' }, processes: { verdict: 'none' } };
  } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'worker-owner-changed');
  assert.equal(jobOf(m, job.job_id).payload.terminalClosed, undefined);
  assert.equal(m.latestSupAttempt(job.job_id).closed_at, null);
  assert.ok(openWorkerHandles(m).has(newer));
}));
