// The one [Supervisor] kernel, its [Worker] fix agents, the land gate and the chat relay
// (modules/supervisor/supervise.yaml kernelSeat/workers/landGate/chat, docs/supervisor.md).
// Every spec runs on a temp supervisor home, a temp STARCI_LOCAL_ROOT and, for git, a temp repository:
// no live Orca (a [Worker] staging checkout goes through the fake Orca worktree client,
// tests/helpers/fake-orca-worktrees.mjs), no agent, no network, never the live runtime.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { fakeAdmission } from '../helpers/fake-admission.mjs';

import { launchSupervisor, stopSupervisor, planSupervisorDedupe, doctrineOf, SEAT_DENIED_TOOLS, seatHealth } from '../../scripts/supervisor/start-supervisor.mjs';
import { seatToolDecision } from '../../scripts/guards/seat-tools.mjs';
import { withSupervisor, readSupervisor, seatOf, enabledOf, writeSeat, supervisorEvent, SUPERVISOR_ID, SKILL_ROOT } from '../../scripts/machine/home.mjs';
import {
  adaptiveCap, createJob, spawnWorkers, createStaging, removeStaging, fileReport, jobOf, leaseConflicts, pickWorkerPool, cancelJob, ackReport,
  stageSelf, workerGuard, READINESS_FAILS_PER_HOUR, openWorkerHandles,
} from '../../scripts/supervisor/workers.mjs';
import { landCommits, land, specsTouching, specPlan, runChecks, describe, acquireLand, landQueue, specTimeoutMs, LAND_WAIT_MS } from '../../scripts/supervisor/land.mjs';
import { scanDiff, defaultPushRepos, boundRepos } from '../../scripts/supervisor/push-mains.mjs';
import { directCommits, gateLandedShas } from '../../scripts/supervisor/direct-commits.mjs';
import { tell, replies, sinceMs } from '../../scripts/supervisor/tell.mjs';
import { replyToOwner, registrationRefusal } from '../../scripts/supervisor/channel.mjs';
import { registerSupervisor, createBridge } from '../../scripts/supervisor/telegram-bridge.mjs';
import { appendInbox, readInbox, readOutbox } from '../../scripts/machine/sup-messages.mjs';
import { planWake, busyScreen, watchdogPass, sweepWorkers } from '../../scripts/supervisor/supervisor-watchdog.mjs';
import { orcaTreeFindings, readTerminals, supervisorWorkerHandles } from '../../scripts/supervisor/orca-tree.mjs';
import { withLedger } from '../helpers/ledger-fixture.mjs';
import { clusterOwed } from '../../scripts/supervisor/cluster.mjs';
import { renderSupervisorBlock, supervisorSnapshot } from '../../scripts/supervisor/status-block.mjs';
import { recordedSeatTerminals, seatSessions, entryTerminalOf } from '../../scripts/supervisor/seat-sessions.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { loadRuntimes } from '../../scripts/agent/models.mjs';
import { withMachine, openMachine } from '../../engine/db/machine.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';

// git's repository-local variables (git rev-parse --local-env-vars) never reach a fixture: a hook or alias run in a linked
// worktree exports GIT_DIR, and every fixture git then writes THAT repository whatever cwd or -C it names - a temp dir's
// `git init` re-inited the live .claude repo core.bare=true (2026-09-29, tests/repo/live-core-bare.spec.mjs).
for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_IMPLICIT_WORK_TREE', 'GIT_PREFIX', 'GIT_CONFIG', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_GRAFT_FILE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_REPLACE_REF_BASE', 'GIT_SHALLOW_FILE']) delete process.env[key];

// Specs here hold ledger handles a later t.after closes; the per-test rm below can run ahead of them and
// EPERM on the open sqlite. A file-level after() runs after every hook, so anything a swallowed EPERM left
// comes down then - the suite's temp-root guard never sees it.
const TEMP_DIRS = [];
after(() => { for (const dir of TEMP_DIRS) { try { spawnSync('git', ['-C', dir, 'worktree', 'prune'], { windowsHide: true }); } catch { /* none */ } try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* still held */ } } });
const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TEMP_DIRS.push(dir);
  // This hook can run before a later hook closes its SQLite handle. Do one best-effort removal here;
  // the file-level after() above owns the retrying removal once every handle is closed.
  t.after(() => { try { spawnSync('git', ['-C', dir, 'worktree', 'prune'], { windowsHide: true }); } catch { /* none */ } try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* an open ledger handle closes after this hook */ } });
  return dir;
};
// These specs exercise the optional [Supervisor] kernel: config.yaml supervisor.mode kernel (the default is chat).
/** A machine.sqlite writer handle (the Supervisor's store) on the spec's own file, closed after the test. */
const machineOf = (t, env) => { const m = openMachine({ env }); t.after(() => m.close()); return m; };
/** The fake Orca worktree client of one spec: its trees under a temp workspace root. */
const orcaOf = (t) => fakeOrcaWorktrees({ root: tmp(t, 'sup-orca-') });
const envOf = (t) => { const root = tmp(t, 'sup-k-'); return { STARCI_LOCAL_ROOT: path.join(root, 'la'), STARCI_LANES_ROOT: path.join(root, 'lanes'), STARCI_SUPERVISOR_MODE: 'kernel', STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') }; };

/* ------------------------------------------------------------ fake Orca */

// The seat is a worker-start worker: `start` is scripts/agent/lib.mjs startAgent, `show`/`stop`/`release` the worker
// verbs on its Dispatch (workers: dispatch -> state), `bindSeat` the seat guard the PreToolUse hook enforces.
function fakeHost({ terminals = [], live = new Set(), screens = {}, spawnOk = true, hostDown = false, workers = new Map(), entry = true } = {}) {
  const calls = { start: [], close: [], quit: [], stop: [], release: [], bind: [] };
  let n = 0;
  return {
    calls, live, workers,
    list: () => (hostDown ? { ok: false, hostUnavailable: true } : { ok: true, terminals: entry ? [...terminals, { handle: 'term_entry', title: 'pwsh', worktreePath: SKILL_ROOT, writable: true }] : terminals, visualLayouts: [] }),
    tabTitles: (_layouts, rows) => new Map(rows.map((r) => [r.handle, r.tab ?? null])),
    screen: (h) => screens[h] ?? '> ',
    exitedRow: (s) => (/PS [^>]*>\s*$/.test(s) ? s.trim() : null),
    close: (h) => { calls.close.push(h); live.delete(h); return { ok: true }; },
    quit: (h) => { calls.quit.push(h); return { sent: true, exited: false }; },
    show: (d) => (hostDown ? { ok: false, hostUnavailable: true, error: 'down' } : workers.has(d) ? { ok: true, state: workers.get(d) } : { ok: false, error: 'no such worker' }),
    stop: (d) => { calls.stop.push(d); workers.set(d, 'stopped'); return { ok: true }; },
    release: (d) => { calls.release.push(d); workers.set(d, 'released'); return { ok: true, handle: `term_new${String(d).replace('ctx_new', '')}`, closed: { ok: true, proof: 'gone' }, processes: { verdict: 'none' } }; },
    bindSeat: (h) => { calls.bind.push(h); return `guards/seats/${h}.json`; },
    start: (opts) => {
      calls.start.push(opts);
      if (!spawnOk) return { ok: false, step: 'worker-start', error: 'refused', effectState: 'none' };
      const h = `term_new${++n}`, d = `ctx_new${n}`; live.add(h); workers.set(d, 'ready');
      return { ok: true, terminal: h, dispatchId: d, runId: 'run_sup', taskId: `task_${n}`, effective: { agent: opts.provider, model: opts.model } };
    },
  };
}
const settings = { agent: 'claude', model: 'claude-opus-5-5', effort: 'high', repos: [], pollIntervalMs: 600000, language: 'vi', workers: { base: 4, max: 10 }, landGate: { mode: 'shared', push: false } };
const launch = (env, host, extra = {}) => launchSupervisor({ env, deps: host, settings, template: '{launchAuthority}\n{doctrine}', doc: { kernelSeat: { does: ['x'] } }, ...extra });

test('a refused worker observation is unverified rather than affirmative death', () => {
  const seat = { value: { terminal: 'owned-terminal', dispatch: 'owned-dispatch' } };
  const refused = seatHealth(seat, { show: () => ({ ok: false, error: 'host contract unavailable', hostUnavailable: false }) });
  assert.equal(refused.unverified, true);
  assert.equal(refused.dead, undefined);
  assert.equal(seatHealth(seat, { show: () => ({ ok: true, state: 'released' }) }).dead, true);
});

test('Supervisor plans neither create an absent machine store nor rewrite a store of another schema version', async t => {
  for (const foreign of [false, true]) {
    const env = envOf(t), file = env.STARCI_TEST_MACHINE_FILE;
    if (foreign) {
      const machine = openMachine({ env });
      machine.meta(); machine.close();
      const raw = new DatabaseSync(file);
      try { raw.exec('PRAGMA user_version=1'); } finally { raw.close(); }
    }
    const before = foreign ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
    const host = fakeHost(), observations = fakeAdmission();
    host.admission = { quota: observations.quota, circuit: () => null };
    if (foreign) await assert.rejects(() => launch(env, host, { plan: true }), { code: 'STARCI_MACHINE_SCHEMA_OLD' });
    else {
      const result = await launch(env, host, { plan: true });
      assert.equal(result.action, 'plan');
      assert.equal(result.admission.ok, false, 'read-only plans refuse unobserved capacity');
      assert.equal(result.wouldLaunch, false);
    }
    assert.equal(host.calls.start.length, 0);
    if (foreign) {
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), before, 'planning preserves all refused-store bytes');
      const raw = new DatabaseSync(file, { readOnly: true });
      try { assert.equal(raw.prepare('PRAGMA user_version').get().user_version, 1); }
      finally { raw.close(); }
    } else assert.equal(fs.existsSync(file), false, 'planning creates no machine database');
  }
});

test('a stale Supervisor seat survives unproven worker closure and blocks replacement or stop clearance', async t => {
  for (const stop of [false, true]) {
    const env = envOf(t), host = fakeHost();
    const first = await launch(env, host);
    host.workers.set(first.dispatch, 'failed');
    host.release = () => ({ ok: true, handle: first.terminal, closed: { ok: true, proof: 'gone' }, processes: { verdict: 'unverifiable' } });
    const previous = readSupervisor(m => seatOf(m), null, { env });
    const result = stop ? await stopSupervisor({ env, deps: host }) : await launch(env, host);
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.effectState, 'unknown');
    assert.equal(readSupervisor(m => seatOf(m).token, null, { env }), previous.token, 'the original singleton identity remains held');
    assert.equal(host.calls.start.length, 1, 'an unproven process exit never admits another Supervisor');
  }
});

test('an expired Supervisor startup with a live capacity receipt retains its seat on restart and stop', async t => {
  for (const stop of [false, true]) {
    const env=envOf(t), host=fakeHost();
    const first=await launch(env,host);
    const prior=readSupervisor(m=>seatOf(m),null,{env});
    withMachine(m=>{
      const reserved=m.reserveProvider({provider:'claude',account:'default',attemptId:'supervisor-crash',role:'supervisor',
        model:settings.model,maxParallel:3,scope:{scopeId:`${SUPERVISOR_ID}:attempt:1`}}).reservation;
      m.markProviderReservation({...reserved,state:'live',handle:first.terminal});
      writeSeat(m,{token:prior.token,value:{state:'starting',attempt:1},expiresAt:Date.now()-1});
    },{env});
    const result=stop?await stopSupervisor({env,deps:host}):await launch(env,host);
    assert.equal(result.ok,false,'an elapsed startup timer proves no process exit');
    assert.equal(readSupervisor(m=>seatOf(m).token,null,{env}),prior.token);
    assert.equal(host.calls.start.length,1);
    assert.equal(readSupervisor(m=>m.providerReservations({activeOnly:true}).length,null,{env}),1);
  }
});

test('singleton: one launch boots the seat; a second start with the seat live launches nothing', async (t) => {
  const env = envOf(t);
  const host = fakeHost();
  const first = await launch(env, host);
  assert.equal(first.action, 'booted');
  assert.equal(host.calls.start.length, 1);
  assert.equal(host.calls.start[0].title, '[Supervisor] main');
  const again = await launch(env, host);
  assert.equal(again.action, 'already-live');
  assert.equal(host.calls.start.length, 1, 'never a second [Supervisor]');
  assert.equal(readSupervisor((m) => seatOf(m).value.terminal, null, { env }), first.terminal);
  assert.equal(readSupervisor((m) => enabledOf(m), null, { env }), true);
});

test('singleton: an unknown Supervisor launch retains its seat and cannot start a replacement', async t => {
  const env = envOf(t), host = fakeHost();
  host.start = options => { host.calls.start.push(options); return { ok: false, step: 'worker-start', effectState: 'unknown', dispatchId: 'uncertain-supervisor' }; };
  const first = await launch(env, host);
  assert.equal(first.effectState, 'unknown');
  assert.equal(readSupervisor(m => seatOf(m).value.state, null, { env }), 'launch-unknown');
  const second = await launch(env, host);
  assert.equal(second.action, 'host-unavailable');
  assert.equal(host.calls.start.length, 1);
});

test('workers: unknown launch retains leases and staging and is never requeued', async t => {
  const env = envOf(t), m = machineOf(t, env), job = createJob(m, { cluster: 'uncertain', files: ['scripts/uncertain.mjs'] }).job;
  let starts = 0, removed = 0;
  const deps = { load: () => ({ cpuBusy: 0, freeMem: 1 }), route: async () => ({ pool: 'codex-agent', agent: 'codex', model: 'gpt-6.1-sol' }),
    staging: ({ jobId }) => ({ ok: true, path: `/tmp/${jobId}`, branch: 'uncertain', base: 'abc', orcaId: 'fixture' }),
    unstage: () => { removed += 1; }, guard: () => ({ receipt: {} }),
    start: () => { starts += 1; return { ok: false, effectState: 'unknown', dispatchId: 'uncertain-worker' }; } };
  const first = await spawnWorkers(m, { settings, env, deps });
  assert.equal(first.failed[0].requeued, false);
  assert.equal(jobOf(m, job.job_id).status, 'spawning');
  assert.ok(jobOf(m, job.job_id).payload.staging);
  assert.ok(leaseConflicts(m, ['scripts/uncertain.mjs'], 'other').length);
  await spawnWorkers(m, { settings, env, deps });
  assert.equal(starts, 1); assert.equal(removed, 0);
});

test('singleton: a live startup reservation, a host outage and a disabled seat all launch nothing', async (t) => {
  const env = envOf(t);
  withMachine((m) => writeSeat(m, { token: 'tok', value: { state: 'starting' }, expiresAt: Date.now() + 60_000 }), { env });
  const host = fakeHost();
  assert.equal((await launch(env, host)).action, 'starting');
  const down = fakeHost({ hostDown: true });
  const env2 = envOf(t);
  const seeded = await launch(env2, fakeHost());
  assert.equal(seeded.action, 'booted');
  const out = await launch(env2, down);
  assert.equal(out.action, 'host-unavailable');
  assert.equal(out.exit, 75);
  assert.equal(down.calls.start.length, 0);
  const stopped = await stopSupervisor({ env: env2, deps: fakeHost() });
  assert.equal(stopped.action, 'stopped');
  const replace = await launch(env2, fakeHost(), { mode: 'replace' });
  assert.equal(replace.action, 'disabled', 'the watchdog never relaunches a stopped seat');
});

/** Record `handles` as earlier seat sessions: a supervisor-booted event each, the way a launch writes it. */
const recordSeats = (env, handles) => withMachine((m) => { for (const terminal of handles) supervisorEvent(m, { kind: 'supervisor-booted', payload: { terminal } }); }, { env });

test('singleton dedupe: with the seat dead every RECORDED seat session is closed and one worker starts; none is adopted', async (t) => {
  const env = envOf(t);
  recordSeats(env, ['term_a', 'term_b', 'term_c']);
  const terminals = [
    { handle: 'term_a', title: '✳ supervisor tick', tab: '[Supervisor] main' },
    { handle: 'term_b', title: 'x', tab: '[Supervisor] main' },
    { handle: 'term_c', title: 'shell', tab: '[Supervisor] main' },
    { handle: 'term_k', title: 'kernel', tab: '[Kernel] wf-x' },
  ];
  const host = fakeHost({ terminals, live: new Set(['term_a', 'term_b', 'term_c', 'term_k']), screens: { term_c: `PS ${os.tmpdir()}> ` } });
  const out = await launch(env, host);
  assert.equal(out.action, 'booted');
  assert.equal(host.calls.start.length, 1, 'the seat is a new worker-start worker');
  assert.deepEqual(out.closedDuplicates.map((c) => c.handle).sort(), ['term_a', 'term_b', 'term_c']);
  assert.ok(!host.calls.close.includes('term_k'), 'a kernel terminal is never touched');
  const plan = planSupervisorDedupe({ marked: [{ handle: 's' }, { handle: 'd' }], seatTerminal: 's', screenOf: () => '> ', exitedRow: () => null });
  assert.deepEqual(plan.close.map((c) => c.handle), ['d']);
  assert.equal(plan.adopt, undefined, 'a terminal is never adopted as the seat');
});

test('a terminal titled [Supervisor] with no seat record (a smoke, an owner-opened session) is never quit and never closed', async (t) => {
  const env = envOf(t);
  const terminals = [
    { handle: 'term_smoke', title: '[Supervisor] launch smoke', tab: '[Supervisor] launch smoke' },
    { handle: 'term_owner', title: 'claude', tab: '[Supervisor] main' },
  ];
  const host = fakeHost({ terminals, live: new Set(['term_smoke', 'term_owner']) });
  const out = await launch(env, host);
  assert.equal(out.action, 'booted');
  assert.deepEqual([host.calls.close, host.calls.quit], [[], []], 'nothing is reaped');
  assert.equal(out.closedDuplicates, undefined);
  // The same with the seat live: a live seat plus a smoke Supervisor leaves the smoke running.
  const again = await launch(env, host);
  assert.equal(again.action, 'already-live');
  assert.deepEqual([host.calls.close, host.calls.quit], [[], []]);
  withMachine((m) => assert.deepEqual([...recordedSeatTerminals(m)], [out.terminal]), { env });
});

test('a recorded seat session that is not the current seat is a duplicate even when the seat is live', async (t) => {
  const env = envOf(t);
  const host = fakeHost({ terminals: [{ handle: 'term_old', title: 'claude', tab: '[Supervisor] main' }], live: new Set(['term_old']) });
  recordSeats(env, ['term_old']);
  const first = await launch(env, host);
  assert.equal(first.action, 'booted');
  recordSeats(env, ['term_old']);
  host.calls.close.length = 0;
  const again = await launch(env, host);
  assert.equal(again.action, 'already-live');
  assert.deepEqual(again.closedDuplicates.map((c) => c.handle), ['term_old']);
  assert.deepEqual(host.calls.quit, ['term_old', 'term_old']);
});

test('a seat start from the reconciler (no ORCA_TERMINAL_HANDLE) names an existing terminal as the sender', async (t) => {
  const env = envOf(t);
  const terminals = [
    { handle: 'term_other', title: 'pwsh', worktreePath: path.join(os.tmpdir(), 'elsewhere'), writable: true },
    { handle: 'term_root', title: 'pwsh', worktreePath: SKILL_ROOT, writable: true },
  ];
  const host = fakeHost({ terminals, entry: false });
  assert.equal((await launch(env, host)).action, 'booted');
  assert.equal(host.calls.start[0].entry, 'term_root', 'the runtime worktree terminal wins');
  const own = fakeHost({ terminals, entry: false });
  await launch(envOf(t), own, { env: { ...envOf(t), ORCA_TERMINAL_HANDLE: 'term_self' } });
  assert.equal(own.calls.start[0].entry, 'term_self', 'the caller own terminal wins');
  assert.equal(entryTerminalOf({ env: {}, listing: { terminals }, recorded: new Set(['term_root']) }), null, 'a foreign terminal outside the runtime worktree is never the sender');
  const foreignOnly = fakeHost({ terminals: [terminals[0]], entry: false });
  const refused = await launch(envOf(t), foreignOnly);
  assert.deepEqual([refused.action, refused.step, foreignOnly.calls.start.length], ['launch-failed', 'run-create', 0]);
  assert.match(refused.error, /no_active_sender_terminal.*runtime's own worktree/);
  assert.equal(entryTerminalOf({ env: {}, listing: { terminals: [] } }), null);
});

test('the prompt doctrine is built from supervise.yaml kernelSeat', () => {
  const doc = parseYaml(fs.readFileSync(new URL('../../modules/supervisor/supervise.yaml', import.meta.url), 'utf8'));
  const text = doctrineOf(doc);
  assert.match(text, /single brain/);
  assert.match(text, /never answers|answers an owner ask/);
  assert.ok(doc.guardrails.some((g) => g.id === 'one-supervisor-seat'));
  assert.ok(!doc.guardrails.some((g) => g.id === 'chat-only-debug-mode'), 'the chat-only rule is replaced');
  for (const key of ['kernelSeat', 'workers', 'landGate', 'chat']) assert.ok(doc[key], key);
});

/* ------------------------------------------------------------ workers */

test('worker cap: adaptive with the queue, halved under load, never above 10', () => {
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 0 }).cap, 4);
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 5 }).cap, 7);
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 40 }).cap, 10);
  assert.equal(adaptiveCap({ base: 4, max: 99, queued: 99 }).cap, 10, 'the hard ceiling is 10');
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 5, load: { cpuBusy: 0.9, freeMem: 0.5 } }).cap, 3);
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 5, load: { cpuBusy: 0.99, freeMem: 0.5 } }).cap, 1);
  assert.equal(adaptiveCap({ base: 4, max: 10, queued: 0, running: 3 }).free, 1);
});

test('workers: one job per cluster, launches stop at the cap, a leased file waits', async (t) => {
  const env = envOf(t);
  const m = machineOf(t, env);
  const a = createJob(m, { cluster: 'c1', files: ['scripts/a.mjs'] });
  assert.equal(createJob(m, { cluster: 'c1', files: ['scripts/z.mjs'] }).created, false, 'one worker per cluster');
  createJob(m, { cluster: 'c2', files: ['scripts/a.mjs'] });
  createJob(m, { cluster: 'c3', files: ['scripts/b.mjs'] });
  createJob(m, { cluster: 'c4', files: ['scripts/c.mjs'] });
  const spawned = [];
  const deps = {
    load: () => ({ cpuBusy: 0.99, freeMem: 0.5 }),
    route: async () => ({ pool: 'devin-agent', agent: 'devin', model: 'm', effort: null }),
    staging: ({ jobId }) => ({ ok: true, path: `/tmp/${jobId}`, branch: `sup-${jobId}`, base: 'abc', orcaId: `repo::/tmp/${jobId}` }),
    unstage: () => ({}),
    start: (opts) => { spawned.push(opts); return { ok: true, terminal: `term_${spawned.length}`, dispatchId: `ctx_${spawned.length}` }; },
  };
  const r = await spawnWorkers(m, { settings, deps, env });
  assert.equal(r.cap.cap, 1, 'a saturated machine runs one worker');
  assert.equal(r.launched.length, 1);
  assert.equal(spawned[0].title, '[Worker] c1');
  assert.equal(spawned[0].worktree, `/tmp/${a.job.job_id}`, 'a [Worker] starts through worker-start on its staging checkout');
  assert.equal(typeof spawned[0].onCreated, 'function', 'its guard is bound to the worker terminal the moment it exists');
  assert.equal(jobOf(m, a.job.job_id).payload.dispatch, 'ctx_1', 'the job keeps the Dispatch its liveness and release read');
  assert.equal(jobOf(m, a.job.job_id).status, 'running');
  const attempt = m.latestSupAttempt(a.job.job_id);
  assert.equal(attempt.terminal_handle, 'term_1', 'one sup_attempts row per spawn names its terminal');
  assert.equal(attempt.branch, `sup-${a.job.job_id}`);
  deps.load = () => ({ cpuBusy: 0.1, freeMem: 0.9 });
  const r2 = await spawnWorkers(m, { settings, deps, env });
  assert.ok(r2.skipped.some((s) => /files leased by/.test(s.reason)), 'c2 waits for the lease on scripts/a.mjs');
  assert.equal(r2.launched.length, 2);
  assert.deepEqual(leaseConflicts(m, ['scripts/a.mjs']).map((c) => c.jobId), [a.job.job_id]);
});

test('worker routing: the balanced pick skips an unavailable provider and prefers the furthest below its share', async () => {
  const runtimes = loadRuntimes(path.join(SKILL_ROOT, 'modules', 'models'));
  const shares = { 'claude-agent': 25, 'codex-agent': 25, 'devin-agent': 25 };
  const pick = await pickWorkerPool({ shares, runtimes, recent: { 'claude-agent': 5, 'codex-agent': 5, 'devin-agent': 0 } });
  assert.equal(pick.agent, 'devin');
  const skip = await pickWorkerPool({ shares, runtimes, recent: { 'devin-agent': 0, 'claude-agent': 9, 'codex-agent': 1 },
    availabilityOf: (p) => (p === 'devin' ? { state: 'unavailable', reason: 'circuit open' } : { state: 'available' }) });
  assert.equal(skip.agent, 'codex');
  assert.ok(skip.skipped.some((s) => s.pool === 'devin-agent'));
});

test('worker readiness: a refused worker-start excludes the provider', async (t) => {
  const env = envOf(t);
  const m = machineOf(t, env);
  const runtimes = loadRuntimes(path.join(SKILL_ROOT, 'modules', 'models'));
  const shares = { 'claude-agent': 25, 'codex-agent': 25, 'devin-agent': 25 };
  const recent = { 'claude-agent': 9, 'codex-agent': 5, 'devin-agent': 0 };
  const a = createJob(m, { cluster: 'r1', files: ['scripts/r1.mjs'] });
  const b = createJob(m, { cluster: 'r2', files: ['scripts/r2.mjs'] });
  const routed = [], spawned = [];
  const deps = {
    load: () => ({ cpuBusy: 0, freeMem: 1 }),
    route: async ({ prefer, avoid }) => { routed.push({ prefer, avoid }); return pickWorkerPool({ shares, runtimes, recent, prefer, avoid }); },
    staging: ({ jobId }) => ({ ok: true, path: `/tmp/${jobId}`, branch: `sup-${jobId}`, base: 'abc', orcaId: `repo::/tmp/${jobId}` }),
    unstage: () => ({}),
    start: (opts) => { spawned.push(opts); return opts.provider === 'devin' ? { ok: false, step: 'worker-start', effectState: 'none', error: 'agent_readiness_failed' } : { ok: true, terminal: `term_${spawned.length}`, dispatchId: `ctx_${spawned.length}` }; },
  };
  const r = await spawnWorkers(m, { settings, deps, env });
  assert.equal(spawned[0].provider, 'devin', 'devin is furthest below its share');
  assert.equal(spawned[1].provider, 'codex', 'the rest of the pass skips the provider that just failed readiness');
  assert.deepEqual(r.failed.map((f) => f.jobId), [a.job.job_id]);
  const requeued = jobOf(m, a.job.job_id);
  assert.equal(requeued.status, 'queued');
  assert.deepEqual(requeued.payload.avoidAgents, ['devin']);
  assert.equal(requeued.payload.agent, null, 'the requeued job keeps its own agent request, not the provider routed to it');
  assert.ok(m.latestSupAttempt(a.job.job_id).cancelled_at, 'the failed spawn attempt is closed');
  const r2 = await spawnWorkers(m, { settings, deps, env });
  assert.equal(r2.launched[0].jobId, a.job.job_id);
  assert.notEqual(r2.launched[0].agent, 'devin', 'a requeued job is never re-routed to the provider that failed it');
  assert.ok(routed.at(-1).avoid.includes('devin'));
  assert.equal(jobOf(m, b.job.job_id).status, 'running');
  // READINESS_FAILS_PER_HOUR failures in the hour exclude the provider for every job, fresh ones included.
  for (let i = 0; i < READINESS_FAILS_PER_HOUR; i += 1) supervisorEvent(m, { entityType: 'job', entityId: `x${i}`, kind: 'worker-spawn-failed', payload: { agent: 'claude', step: 'worker-start' } });
  createJob(m, { cluster: 'r3', files: ['scripts/r3.mjs'] });
  await spawnWorkers(m, { settings, deps, env });
  assert.ok(routed.at(-1).avoid.includes('claude'), JSON.stringify(routed.at(-1)));
});

test('worker outage: an attestation refused for a provider capacity outage excludes the provider like a readiness failure', async (t) => {
  const env = envOf(t);
  const m = machineOf(t, env);
  const runtimes = loadRuntimes(path.join(SKILL_ROOT, 'modules', 'models'));
  const shares = { 'claude-agent': 25, 'codex-agent': 25, 'devin-agent': 25 };
  const recent = { 'claude-agent': 9, 'codex-agent': 5, 'devin-agent': 0 };
  const a = createJob(m, { cluster: 'q1', files: ['scripts/q1.mjs'] });
  const b = createJob(m, { cluster: 'q2', files: ['scripts/q2.mjs'] });
  const routed = [], spawned = [];
  const quota = 'attestation rejected: We are currently experiencing capacity issues with this serving model';
  const deps = {
    load: () => ({ cpuBusy: 0, freeMem: 1 }),
    route: async ({ prefer, avoid }) => { routed.push({ prefer, avoid }); return pickWorkerPool({ shares, runtimes, recent, prefer, avoid }); },
    staging: ({ jobId }) => ({ ok: true, path: `/tmp/${jobId}`, branch: `sup-${jobId}`, base: 'abc', orcaId: `repo::/tmp/${jobId}` }),
    unstage: () => ({}),
    start: (opts) => { spawned.push(opts); return opts.provider === 'devin' ? { ok: false, step: 'attestation', effectState: 'none', error: quota } : { ok: true, terminal: `term_${spawned.length}`, dispatchId: `ctx_${spawned.length}` }; },
  };
  await spawnWorkers(m, { settings, deps, env });
  assert.equal(spawned[0].provider, 'devin', 'devin is furthest below its share');
  assert.equal(spawned[1].provider, 'codex', 'the rest of the pass skips the provider in outage');
  const requeued = jobOf(m, a.job.job_id);
  assert.equal(requeued.status, 'queued');
  assert.deepEqual(requeued.payload.avoidAgents, ['devin']);
  const r2 = await spawnWorkers(m, { settings, deps, env });
  assert.equal(r2.launched[0]?.jobId, a.job.job_id, JSON.stringify(r2));
  assert.notEqual(r2.launched[0].agent, 'devin', 'the requeued job is never re-routed to the provider in outage');
  assert.ok(routed.at(-1).avoid.includes('devin'));
  assert.equal(jobOf(m, b.job.job_id).status, 'running');
  // An attestation failure that is no outage (a wrong model on screen) excludes nothing.
  const c = createJob(m, { cluster: 'q3', files: ['scripts/q3.mjs'] });
  const other = { ...deps, route: async () => pickWorkerPool({ shares, runtimes, recent, prefer: 'devin' }), start: () => ({ ok: false, step: 'attestation', error: 'attestation rejected: model mismatch' }) };
  await spawnWorkers(m, { settings, deps: other, env, jobId: c.job.job_id });
  assert.equal(jobOf(m, c.job.job_id).payload.avoidAgents, undefined);
});

test('worker guard: a [Worker] owns its leased files, so its git shim lets it stage and commit them', async (t) => {
  const env = envOf(t);
  const m = machineOf(t, env);
  const job = createJob(m, { cluster: 'g1', files: ['scripts/g1.mjs', 'tests/g1.spec.mjs'] });
  const guarded = [], launched = [];
  const deps = {
    load: () => ({ cpuBusy: 0, freeMem: 1 }),
    route: async () => ({ pool: 'claude-agent', agent: 'claude', model: 'm' }),
    staging: ({ jobId }) => ({ ok: true, path: `/tmp/${jobId}`, branch: `sup-${jobId}`, base: 'abc', orcaId: `repo::/tmp/${jobId}` }),
    unstage: () => ({}), command: () => null,
    guard: (jobId, opts) => workerGuard(jobId, { ...opts, launch: (args) => { launched.push(args); return { env: {}, pathPrefix: 'bin', receipt: {} }; } }),
    start: (opts) => { guarded.push(opts); return { ok: true, terminal: 'term_g', dispatchId: 'ctx_g' }; },
  };
  await spawnWorkers(m, { settings, deps, env });
  assert.equal(guarded.length, 1);
  assert.deepEqual(launched[0].owned, [path.resolve(`/tmp/${job.job.job_id}`, 'scripts/g1.mjs'), path.resolve(`/tmp/${job.job.job_id}`, 'tests/g1.spec.mjs')]);
  assert.equal(launched[0].jobId, job.job.job_id);
});

/* ------------------------------------------------------------ git fixtures */

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
let REPO_BASELINE = null;
function repoBaseline() {
  if (REPO_BASELINE) return REPO_BASELINE;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sup-repo-base-'));
  TEMP_DIRS.push(root);
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Spec');
  git(root, 'config', 'user.email', 'spec@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'modules', 'kernel'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts', 'a.mjs'), 'export const a = 1;\n');
  fs.mkdirSync(path.join(root, 'packages', 'grammar'), { recursive: true });
  fs.writeFileSync(path.join(root, 'packages', 'grammar', 'CHANGELOG.md'), '# Changelog\n\n');
  fs.writeFileSync(path.join(root, 'modules', 'kernel', 'rules.yaml'), 'rule: one\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  REPO_BASELINE = root;
  return root;
}
function repoFixture(t) {
  const root = tmp(t, 'sup-repo-');
  fs.cpSync(repoBaseline(), root, { recursive: true });
  return root;
}
/** A commit on a side branch `name` off main that writes `files` ({path: content}); returns its sha. */
function sideCommit(root, name, files, base = 'main') {
  const wt = path.join(root, '..', `${path.basename(root)}-${name}`);
  git(root, 'worktree', 'add', '-q', '-b', name, wt, base);
  for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(wt, f)), { recursive: true }); fs.writeFileSync(path.join(wt, f), c); }
  git(wt, 'add', '-A');
  git(wt, 'commit', '-q', '-m', name);
  const sha = git(wt, 'rev-parse', 'HEAD');
  git(root, 'worktree', 'remove', '--force', wt);
  return sha;
}

test('staging lifecycle: an Orca worktree on the branch Orca reported; removal after a land deletes both and never the live node_modules', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const orca = orcaOf(t);
  fs.mkdirSync(path.join(root, 'node_modules', 'dep'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', 'dep', 'index.js'), 'keep');
  const s = createStaging({ jobId: 'fix-x-1', root, env, orca });
  assert.ok(s.ok, s.error);
  assert.ok(fs.existsSync(path.join(s.path, 'scripts', 'a.mjs')));
  assert.equal(s.branch, 'sup-fix-x-1', 'the branch is the one Orca reported for the name');
  assert.ok(git(root, 'branch', '--list', s.branch));
  fs.writeFileSync(path.join(s.path, 'scripts', 'a.mjs'), 'export const a = 2;\n');
  git(s.path, 'commit', '-q', '-am', 'work');
  const kept = removeStaging({ jobId: 'fix-x-1', staging: s, root, env, orca });
  assert.ok(kept.removed && !fs.existsSync(s.path), kept.error);
  assert.equal(kept.branchKept, s.branch, 'unlanded commits keep their branch');
  assert.ok(fs.existsSync(path.join(root, 'node_modules', 'dep', 'index.js')), 'the junction removal never walks into the live node_modules');
  const s2 = createStaging({ jobId: 'fix-y-2', root, env, orca });
  const landed = removeStaging({ jobId: 'fix-y-2', staging: s2, root, env, landed: true, orca });
  assert.ok(landed.removed && landed.branchDeleted, landed.error);
  assert.equal(git(root, 'branch', '--list', s2.branch), '');
});

/* ------------------------------------------------------------ land gate */

const lightChecks = (opts) => runChecks({ ...opts, runSpecs: false });

test('land gate pass: cherry-picked onto current main, live main fast-forwards and the working tree follows', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const sha = sideCommit(root, 'w1', { 'scripts/a.mjs': 'export const a = 42;\n', 'scripts/new.mjs': 'export const n = 1;\n' });
  sideCommit(root, 'other', { 'scripts/b.mjs': 'export const b = 1;\n' });
  git(root, 'merge', '-q', '--ff-only', 'other');   // main moved after the worker branched: rebase-free apply still lands
  const r = landCommits({ commits: [sha], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(git(root, 'rev-parse', 'main'), r.landed);
  assert.equal(fs.readFileSync(path.join(root, 'scripts', 'a.mjs'), 'utf8'), 'export const a = 42;\n');
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'new.mjs')));
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'b.mjs')));
  assert.equal(git(root, 'status', '--porcelain'), '', 'index and tree match the new main');
});

test('land gate fail: a red check, a conflict or a dirty live path lands nothing', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const before = git(root, 'rev-parse', 'main');
  const bad = sideCommit(root, 'bad', { 'scripts/a.mjs': 'export const a = ;\n' });
  const red = landCommits({ commits: [bad], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(red.reason, 'checks-red');
  assert.ok(red.checks.some((c) => c.name === 'node --check scripts/a.mjs' && !c.ok));
  assert.equal(git(root, 'rev-parse', 'main'), before);
  assert.equal(fs.readFileSync(path.join(root, 'scripts', 'a.mjs'), 'utf8'), 'export const a = 1;\n');

  const good = sideCommit(root, 'good', { 'scripts/a.mjs': 'export const a = 3;\n' });
  fs.writeFileSync(path.join(root, 'scripts', 'a.mjs'), 'export const a = 99; // another lane is editing\n');
  const dirty = landCommits({ commits: [good], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(dirty.reason, 'live-paths-dirty');
  assert.equal(git(root, 'rev-parse', 'main'), before, 'nothing half-lands');
  assert.match(fs.readFileSync(path.join(root, 'scripts', 'a.mjs'), 'utf8'), /another lane/, 'the lane edit is untouched');
  fs.writeFileSync(path.join(root, 'scripts', 'a.mjs'), 'export const a = 1;\n');

  const onMain = sideCommit(root, 'mainedit', { 'scripts/a.mjs': 'export const a = 5;\n' });
  git(root, 'merge', '-q', '--ff-only', 'mainedit');
  const moved = git(root, 'rev-parse', 'main');
  const conflict = landCommits({ commits: [good], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(conflict.reason, 'conflict');
  assert.equal(git(root, 'rev-parse', 'main'), moved);
  assert.ok(onMain);
});

test('land gate: re-landing a landed commit is already-landed and moves nothing, whatever else is dirty', async (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const sha = sideCommit(root, 'once', { 'scripts/a.mjs': 'export const a = 7;\n' });
  const first = landCommits({ commits: [sha], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(first.ok && first.landed, JSON.stringify(first));
  fs.writeFileSync(path.join(root, 'scripts', 'unrelated.mjs'), 'export const u = 1; // another lane\n');
  let checked = false;
  const again = landCommits({ commits: [sha], root, env, push: false, deps: { runChecks: (o) => { checked = true; return lightChecks(o); } } });
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.equal(again.alreadyLanded, first.landed);
  assert.equal(again.landed, null, 'an already-landed pick is no gate land (direct-commits keeps its boundary)');
  assert.equal(again.reason, undefined);
  assert.equal(checked, false, 'no checks or specs run for an empty diff');
  assert.equal(git(root, 'rev-parse', 'main'), first.landed);
  assert.match(describe(again), /LAND already-landed .*nothing moved/);
  const gate = await land({ commits: [sha], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(gate.ok, true);
  assert.deepEqual(readSupervisor((m) => gateLandedShas(m), [], { env }), [], 'no land-passed sha is recorded for it');
});

test('land gate queue: the oldest live waiter claims first; a dead waiter ticket is cancelled', (t) => {
  const env = envOf(t);
  withMachine((m) => m.enqueueLand({ lane: 'older', commitSha: 'a'.repeat(40), requestedBy: `pid:${process.ppid}` }), { env });
  const waited = acquireLand({ env, waitMs: 200, pollMs: 50, lane: 'newer', commits: ['b'.repeat(40)] });
  assert.equal(waited.ok, false, 'a newer waiter never claims past an older live one');
  assert.equal(waited.ahead, 1);
  assert.deepEqual(landQueue({ env }).map((q) => q.lane), ['older'], 'the waiter that gave up cancelled its ticket');

  const dead = spawnSync(process.execPath, ['-e', '0'], { windowsHide: true }).pid;
  withMachine((m) => { m.finishLandTicket(landQueue({ env })[0].ticketId, 'cancelled'); m.enqueueLand({ lane: 'dead', commitSha: 'c'.repeat(40), requestedBy: `pid:${dead}` }); }, { env });
  const got = acquireLand({ env, waitMs: 200, pollMs: 50, lane: 'newer', commits: ['b'.repeat(40)] });
  assert.equal(got.ok, true);
  got.release('passed');
  assert.deepEqual(landQueue({ env }), [], 'the dead ticket is cancelled and the served one finished');
});

test('land gate spec timeout grows with the spec count (runtimes.yaml allocation.landGate)', () => {
  const doc = parseYaml(fs.readFileSync(path.join(SKILL_ROOT, 'modules', 'models', 'runtimes.yaml'), 'utf8')).allocation.landGate;
  assert.equal(specTimeoutMs(0), doc.specsBaseMs);
  assert.equal(specTimeoutMs(70), doc.specsBaseMs + 70 * doc.perSpecMs);
  assert.ok(specTimeoutMs(70) > 2_400_000, 'a 70-spec engine change gets more than the old flat 40 minutes');
  assert.equal(LAND_WAIT_MS, doc.waitMs);
});

test('land gate: main moving under the checks reruns the gate on the new main', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const sha = sideCommit(root, 'w', { 'scripts/c.mjs': 'export const c = 1;\n' });
  const lane = sideCommit(root, 'lane', { 'scripts/d.mjs': 'export const d = 1;\n' });
  let calls = 0;
  const r = landCommits({ commits: [sha], root, env, push: false, deps: { runChecks: (o) => {
    calls += 1;
    if (calls === 1) git(root, 'merge', '-q', '--ff-only', lane);   // a lane commits directly meanwhile
    return lightChecks(o);
  } } });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(calls, 2);
  assert.equal(r.attempts[0].reason, 'main-moved');
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'd.mjs')) && fs.existsSync(path.join(root, 'scripts', 'c.mjs')));
  assert.equal(git(root, 'rev-parse', 'main~1'), git(root, 'rev-parse', lane), 'the land sits on top of the lane commit');
});

test('current module edits require actual parse checks and preserve main when those checks refuse', (t) => {
  const env = envOf(t), root = repoFixture(t);
  const changed = sideCommit(root, 'c1', { 'modules/kernel/rules.yaml': 'rule: two\n' });
  const accepted = landCommits({ commits: [changed], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.ok(accepted.ok, JSON.stringify(accepted.checks));
  const main = git(root, 'rev-parse', 'main');
  const broken = sideCommit(root, 'c2', { 'modules/kernel/x.yaml': 'a: [unclosed\n' });
  const refused = landCommits({ commits: [broken], root, env, push: false, deps: { runChecks: lightChecks } });
  assert.equal(refused.ok, false);
  assert.ok(refused.checks.some((c) => c.name === 'parse modules/kernel/x.yaml' && !c.ok));
  assert.equal(git(root, 'rev-parse', 'main'), main);
  assert.deepEqual(specsTouching(['scripts/supervisor/land.mjs', 'tests/x.spec.mjs'], { specs: [{ file: 'tests/a.spec.mjs', text: "import '../scripts/supervisor/land.mjs'" }, { file: 'tests/b.spec.mjs', text: 'nothing' }] }), ['tests/x.spec.mjs', 'tests/a.spec.mjs']);
});

test('land specs: touching by default, never the whole suite (--specs all refused), none needs a reason', async (t) => {
  assert.deepEqual(specPlan({ asked: [], named: ['tests/j.spec.mjs'] }), { mode: 'touching', named: ['tests/j.spec.mjs'] }, 'default: touching, a job named specs included');
  assert.deepEqual(specPlan({ asked: ['tests/a.spec.mjs'] }), { mode: 'touching', named: ['tests/a.spec.mjs'] });
  assert.equal(specPlan({ asked: ['all'] }).refused, 'specs-all-refused', '--specs all is refused while specs.harness is not true');
  assert.equal(specPlan({ asked: ['all'], fullAllowed: true }).mode, 'all');
  assert.equal(specPlan({ asked: ['all'], fullByPushGit: true }).mode, 'all');
  assert.equal(specPlan({ asked: ['none'] }).refused, 'specs-none-needs-reason');
  assert.equal(specPlan({ asked: ['none'], reason: '  ' }).refused, 'specs-none-needs-reason');
  assert.deepEqual(specPlan({ asked: ['none'], reason: 'docs only' }), { mode: 'none', named: [] });
  const env = envOf(t);
  const root = repoFixture(t);
  const red = "import test from 'node:test';\nimport '../scripts/a.mjs';\ntest('red', () => { throw Error('red'); });\n";
  const sha = sideCommit(root, 'sp1', { 'scripts/a.mjs': 'export const a = 7;\n', 'tests/red.spec.mjs': red });
  const touching = await land({ commits: [sha], root, env, push: false });
  assert.equal(touching.specMode, 'touching');
  assert.equal(touching.ok, false, 'the spec touching the change ran and refused');
  assert.ok(touching.checks.some((c) => /^specs \(/.test(c.name) && !c.ok));
  assert.equal((await land({ commits: [sha], specs: ['all'], root, env, push: false, deps: { specsEnabled: () => false } })).reason, 'specs-all-refused');
  assert.equal((await land({ commits: [sha], specs: ['none'], root, env, push: false })).reason, 'specs-none-needs-reason');
  const quiet = await land({ commits: [sha], specs: ['none'], reason: 'fixture change no spec covers', root, env, push: false });
  assert.ok(quiet.ok, JSON.stringify(quiet.checks));
  assert.equal(quiet.specMode, 'none');
  assert.equal(quiet.specReason, 'fixture change no spec covers');
  assert.ok(quiet.checks.some((c) => c.name === 'specs skipped' && c.ok) && !quiet.checks.some((c) => /^specs \(/.test(c.name)), 'no spec suite ran');
});

test('a worker job lands end to end: report -> gate -> succeeded, leases released, checkout and branch removed', async (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const orca = orcaOf(t);
  const m = openMachine({ env });
  const { job } = createJob(m, { cluster: 'e2e', files: ['scripts/a.mjs'] });
  const r = await spawnWorkers(m, { settings, env, root, deps: { orca,
    load: () => ({ cpuBusy: 0, freeMem: 1 }), route: async () => ({ pool: 'claude-agent', agent: 'claude', model: 'm' }),
    start: () => ({ ok: true, terminal: 'term_w', dispatchId: 'ctx_w' }) } });
  assert.equal(r.launched.length, 1);
  const staging = jobOf(m, job.job_id).payload.staging;
  fs.writeFileSync(path.join(staging.path, 'scripts', 'a.mjs'), 'export const a = 7;\n');
  git(staging.path, 'commit', '-q', '-am', 'fix');
  const sha = git(staging.path, 'rev-parse', 'HEAD');
  assert.equal(fileReport(m, { jobId: job.job_id, outcome: 'done', root }).ok, false, 'a done report names its commit');
  const rep = fileReport(m, { jobId: job.job_id, outcome: 'done', commit: sha, root });
  assert.ok(rep.ok, rep.error);
  assert.equal(jobOf(m, job.job_id).status, 'reported');
  m.close();
  const out = await land({ jobId: job.job_id, root, env, push: false, deps: { runChecks: lightChecks, orca } });
  assert.ok(out.ok, JSON.stringify(out));
  assert.equal(fs.readFileSync(path.join(root, 'scripts', 'a.mjs'), 'utf8'), 'export const a = 7;\n');
  const after = machineOf(t, env);
  assert.equal(jobOf(after, job.job_id).status, 'succeeded');
  assert.equal(leaseConflicts(after, ['scripts/a.mjs']).length, 0);
  const attempt = after.latestSupAttempt(job.job_id);
  assert.ok(attempt.landed_at && attempt.landed_sha, 'the attempt records the land');
  assert.equal(after.supReports({ jobId: job.job_id, unconsumed: true }).length, 0, 'the landed report is consumed');
  assert.ok(!fs.existsSync(staging.path), 'the checkout lives only until it lands');
  assert.equal(git(root, 'branch', '--list', staging.branch), '');
  assert.deepEqual(orca.names().filter((n) => n !== 'list'), ['create', 'remove'], 'created and removed through Orca');
  const other = createJob(after, { cluster: 'cancel-me', files: ['scripts/q.mjs'] });
  assert.equal(cancelJob(after, { jobId: other.job.job_id, root, env, orca }).ok, true);
});

test('the grammar changelog is never leased; two appends to the changelog both land through the gate (merge=union)', async (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  fs.writeFileSync(path.join(root, '.gitattributes'), 'packages/grammar/CHANGELOG.md merge=union\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'union changelog');
  const orca = orcaOf(t);
  const m = openMachine({ env });
  const one = stageSelf(m, { name: 'reg-a', files: ['packages/grammar/CHANGELOG.md', 'scripts/a.mjs'], root, env, orca });
  const two = stageSelf(m, { name: 'reg-b', files: ['packages/grammar/CHANGELOG.md', 'scripts/b.mjs'], root, env, orca });
  assert.ok(one.ok && two.ok, JSON.stringify({ one, two }));
  assert.deepEqual(leaseConflicts(m, ['packages/grammar/CHANGELOG.md']), []);
  m.close();
  const log = fs.readFileSync(path.join(root, 'packages', 'grammar', 'CHANGELOG.md'), 'utf8');
  const a = sideCommit(root, 'append-a', { 'packages/grammar/CHANGELOG.md': `${log}## a\n` });
  const b = sideCommit(root, 'append-b', { 'packages/grammar/CHANGELOG.md': `${log}## b\n` });
  for (const sha of [a, b]) {
    const out = await land({ commits: [sha], root, env, push: false, deps: { runChecks: lightChecks, orca } });
    assert.ok(out.ok, JSON.stringify(out));
  }
  const sections = git(root, 'show', 'main:packages/grammar/CHANGELOG.md').split(/\r?\n/).filter((l) => l.startsWith('## '));
  assert.deepEqual(sections, ['## a', '## b']);
});

test('a self checkout landed with --commit closes its job: succeeded, leases released, checkout and branch removed', async (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const orca = orcaOf(t);
  const m = openMachine({ env });
  const one = stageSelf(m, { name: 'tooling', files: ['scripts/a.mjs'], root, env, orca });
  const two = stageSelf(m, { name: 'rules', files: ['scripts/b.mjs'], root, env, orca });
  assert.ok(one.ok && two.ok, JSON.stringify({ one, two }));
  fs.writeFileSync(path.join(one.path, 'scripts', 'a.mjs'), 'export const a = 9;\n');
  git(one.path, 'commit', '-q', '-am', 'self fix');
  const sha = git(one.path, 'rev-parse', 'HEAD');
  // A two-commit self branch landed one commit at a time stays open until its last commit lands.
  fs.writeFileSync(path.join(two.path, 'scripts', 'b.mjs'), 'export const b = 2;\n');
  git(two.path, 'add', '-A');
  git(two.path, 'commit', '-q', '-m', 'r2');
  const r2 = git(two.path, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(two.path, 'scripts', 'b.mjs'), 'export const b = 3;\n');
  git(two.path, 'commit', '-q', '-am', 'r3');
  const r3 = git(two.path, 'rev-parse', 'HEAD');
  m.close();
  const out = await land({ commits: [sha], root, env, push: false, deps: { runChecks: lightChecks, orca } });
  assert.ok(out.ok, JSON.stringify(out));
  let db = openMachine({ env });
  assert.equal(jobOf(db, one.jobId).status, 'succeeded', 'land --commit of a self branch never leaves its job running');
  assert.equal(leaseConflicts(db, ['scripts/a.mjs']).length, 0, 'its leases no longer block a worker');
  assert.ok(!fs.existsSync(one.path));
  assert.equal(git(root, 'branch', '--list', one.branch), '');
  assert.equal(jobOf(db, two.jobId).status, 'running', 'an untouched self job stays open');
  db.close();
  const half = await land({ commits: [r2], root, env, push: false, deps: { runChecks: lightChecks, orca } });
  assert.ok(half.ok, JSON.stringify(half));
  assert.deepEqual(half.selfPending.map((p) => p.jobId), [two.jobId]);
  db = openMachine({ env });
  assert.equal(jobOf(db, two.jobId).status, 'running', 'a partly landed self branch keeps its checkout');
  db.close();
  const rest = await land({ commits: [r3], root, env, push: false, deps: { runChecks: lightChecks, orca } });
  assert.ok(rest.ok, JSON.stringify(rest));
  db = machineOf(t, env);
  assert.equal(jobOf(db, two.jobId).status, 'succeeded');
  assert.equal(leaseConflicts(db, ['scripts/b.mjs']).length, 0);
});

test('the push secret scan names file, line and pattern, never the value', () => {
  const token = ['1234567890', ':AA', 'b'.repeat(33)].join('');
  const diff = `+++ b/src/x.ts\n@@ -1,0 +1,2 @@\n+const ok = 1;\n+const t = '${token}';\n`;
  const found = scanDiff({ diff, files: ['src/x.ts', '.env', '.env.example', 'keys/id_rsa'] });
  assert.deepEqual(found.map((f) => `${f.file}:${f.line}:${f.pattern}`).sort(), ['.env:null:env-file', 'keys/id_rsa:null:private-key-file', 'src/x.ts:2:telegram-bot-token'].sort());
  assert.ok(!JSON.stringify(found).includes(token));
});

test('the push secret scan skips a keyword-assigned value that names itself a fixture, never a token-shaped one', () => {
  const opaque = ['q8Zr', 'Lw3v', 'Tn7x', 'Kp2m'].join('');
  const bot = ['1234567890', ':AA', 'b'.repeat(33)].join('');
  const diff = ['+++ b/tools/stub-server.mjs', '@@ -1,0 +1,3 @@',
    '+  return ENVELOPE({ accessToken: "fixture-access-1" });',
    `+  const cfg = { accessToken: "${opaque}" };`,
    `+  const k = { password: "stub-xxxxxxxx", t: '${bot}' };`].join('\n');
  const found = scanDiff({ diff, files: ['tools/stub-server.mjs'] });
  assert.deepEqual(found.map((f) => `${f.line}:${f.pattern}`), ['2:assigned-secret', '3:telegram-bot-token']);
});

test('the push secret scan skips keyword-assigned values in spec files, never a token-shaped one', () => {
  const opaque = ['q8Zr', 'Lw3v', 'Tn7x', 'Kp2m'].join('');
  const bot = ['1234567890', ':AA', 'b'.repeat(33)].join('');
  const line = `+const details = { password: "${opaque}" };\n+const t = '${bot}';`;
  const diff = ['+++ b/apps/app/src/Auth/index.spec.tsx', '@@ -1,0 +1,2 @@', line, '+++ b/src/config.ts', '@@ -1,0 +1,2 @@', line].join('\n');
  const found = scanDiff({ diff, files: ['apps/app/src/Auth/index.spec.tsx', 'src/config.ts'] });
  assert.deepEqual(found.map((f) => `${f.file}:${f.line}:${f.pattern}`),
    ['apps/app/src/Auth/index.spec.tsx:2:telegram-bot-token', 'src/config.ts:1:assigned-secret', 'src/config.ts:2:telegram-bot-token']);
});

test('push-mains: the default list adds each bound app once, never a guessed sibling', (t) => {
  const source = tmp(t, 'sup-src-');
  const mk = (rel) => { const dir = path.join(source, rel); fs.mkdirSync(dir, { recursive: true }); return dir; };
  const owner = mk('miamia'); const stray = mk('stray-fe');
  const next = mk('next');
  for (const app of [owner, next]) for (const side of ['be', 'fe']) fs.mkdirSync(path.join(app, side));
  const binding = (name, appRoot) => {
    const dir = path.join(source, '.workspaces', 'projects', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'work.json'), JSON.stringify({
      schema: 'starci/workspace-binding@2', project: name,
      repository: { pathFromSource: path.relative(source, appRoot), gitRepository: `https://example.invalid/${name}.git` },
      sides: { be: 'be', fe: 'fe' }, work: { pathFromRepository: '.starciwork' },
    }));
  };
  binding('miamia', owner);
  binding('next', next);
  const cfg = { ...settings, repos: ['miamia', 'next'] };
  assert.deepEqual(boundRepos(owner, { sourceRoot: source }).map((r) => path.resolve(r)), [owner]);
  const list = defaultPushRepos(cfg, { sourceRoot: source });
  assert.deepEqual(list, [SKILL_ROOT, owner, next].map((p) => path.resolve(p)),
    'each app repository is pushed once, with no separate push for its be/ or fe/ folders');
  assert.ok(!list.includes(stray), 'a sibling checkout no binding declares is never pushed');
  assert.deepEqual(defaultPushRepos({ ...settings, repos: ['stray-fe'] }, { sourceRoot: source }), [SKILL_ROOT, stray].map((p) => path.resolve(p)),
    'a ledger owner no binding claims still pushes, with no targets invented');
});

/* ------------------------------------------------------------ chat relay */

test('relay CLI: tell files a desktop message; its reply is recorded locally, never sent to Telegram', async (t) => {
  const env = envOf(t);
  const sent = tell('  what is blocking nivo?  ', { env });
  assert.ok(sent.ok);
  const item = readInbox(SUPERVISOR_ID, env).find((m) => m.id === sent.id);
  assert.equal(item.from, 'desktop');
  assert.equal(item.text, 'what is blocking nivo?');
  const r = await replyToOwner({ id: SUPERVISOR_ID, text: 'nivo waits on inc-x', to: sent.id }, { env, settings: { ready: false }, fetchImpl: () => assert.fail('no Telegram call') });
  assert.equal(r.via, 'desktop');
  assert.ok(readInbox(SUPERVISOR_ID, env).find((m) => m.id === sent.id).read, 'answered means read');
  const list = replies({ since: 0, env });
  assert.equal(list.length, 1);
  assert.equal(list[0].question, 'what is blocking nivo?');
  assert.equal(readOutbox(SUPERVISOR_ID, env)[0].via, 'desktop');
  assert.equal(tell('   ', { env }).ok, false);
  const now = Date.parse('2026-09-24T12:00:00Z');
  assert.equal(sinceMs('30m', now), now - 30 * 60_000);
  assert.equal(sinceMs('2026-09-24T11:00:00Z', now), Date.parse('2026-09-24T11:00:00Z'));
});

test('Telegram routing: owner text lands in the Supervisor kernel inbox; channel main belongs to the kernel terminal', async (t) => {
  const env = envOf(t);
  assert.match(registrationRefusal({ id: 'main', terminal: null, env }), /\[Supervisor\] kernel/);
  assert.equal(registrationRefusal({ id: 'main', terminal: 'term_s', seatTerminal: 'term_s', env }), null);
  assert.match(registrationRefusal({ id: 'main', terminal: 'term_other', seatTerminal: 'term_s', env }), /belongs to the \[Supervisor\] seat/);
  assert.equal(registrationRefusal({ id: 'sup-a', terminal: null, env }), null, 'other ids keep the old rules');
  registerSupervisor({ id: SUPERVISOR_ID, label: 'Supervisor', terminal: 'term_s' }, { env });
  const sentMessages = [];
  const bridge = createBridge({ env, sleepImpl: async () => {}, settings: () => ({ ready: true, token: 't', chatId: '42', language: 'en' }),
    fetchImpl: async (_url, init) => { const body = JSON.parse(init.body); sentMessages.push(body); return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 9 } }) }; },
    statusMessages: () => ['progress'], supervisorStatus: async () => 'SUPERVISOR BLOCK' });
  await bridge.handleUpdate({ update_id: 1, message: { message_id: 5, date: 1, chat: { id: 42 }, from: { id: 42 }, text: 'restart nivo please' } });
  const inbox = readInbox(SUPERVISOR_ID, env);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].text, 'restart nivo please');
  await bridge.handleUpdate({ update_id: 2, message: { message_id: 6, date: 1, chat: { id: 42 }, from: { id: 42 }, text: '/status' } });
  assert.ok(sentMessages.some((m) => m.text === 'SUPERVISOR BLOCK'), '/status adds the Supervisor block');
  const plan = planWake({ now: Date.now(), lastTickAt: Date.now(), unread: inbox, registered: true });
  assert.deepEqual(plan.tags, ['inbox']);
  assert.ok(!plan.text.includes('restart nivo please'), 'owner text is never typed into the terminal');
  const again = planWake({ now: Date.now(), lastTickAt: Date.now(), unread: inbox, wakes: [{ at: Date.now(), payload: { inbox: [inbox[0].id], delivered: true } }] });
  assert.deepEqual(again.tags, [], 'an announced message is not re-woken inside the window');
  assert.deepEqual(planWake({ now: 10 * 60_000 + 1 }).tags, [], 'the Workers controller owns the clock wake');
  appendInbox(SUPERVISOR_ID, { chatId: null, messageId: null, from: 'stall-alert', text: 'STALL-ALERT x' }, { env });
  assert.equal(readInbox(SUPERVISOR_ID, env).at(-1).from, 'stall-alert');
});

test('status block and clustering', (t) => {
  const env = envOf(t);
  withSupervisor((m) => {
    supervisorEvent(m, { entityType: 'tick', kind: 'supervisor-tick', payload: { owed: 12, clusters: 5 }, now: Date.now() - 600_000 });
    supervisorEvent(m, { entityType: 'tick', kind: 'supervisor-tick', payload: { owed: 9, clusters: 4 }, now: Date.now() });
  }, { env });
  const snap = readSupervisor((m) => supervisorSnapshot(m), null, { env });
  const html = renderSupervisorBlock(snap, { language: 'en' });
  assert.match(html, /OWED: <b>9<\/b> ↓/);
  assert.match(html, /12 → 9/);
  const items = [
    { workflowId: 'w1', incidentId: 'inc-aaaaaaaaaaaa', kind: 'source-runtime-defect', labels: ['runtime'], summary: 'watchdog.mjs misreads spinner', ageMin: 5 },
    { workflowId: 'w2', incidentId: 'inc-bbbbbbbbbbbb', kind: 'runtime-contract-defect', labels: ['runtime'], summary: 'again watchdog.mjs spinner', ageMin: 9 },
    { workflowId: 'w2', incidentId: 'inc-cccccccccccc', kind: 'decision', labels: ['decision'], summary: 'pick a port', ageMin: 1 },
  ];
  const clusters = clusterOwed(items);
  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].size, 2);
  assert.deepEqual(clusters[0].workflows.sort(), ['w1', 'w2']);
});

/* ------------------------------------------------------------ 2026-09-24 live defects */

test('the Supervisor seat launches with its subagent tool denied; the prompt sends diagnosis to [Worker]s', async (t) => {
  // worker-start takes no provider argv, so the denial is a seat guard bound to the seat's terminal and enforced by
  // the project PreToolUse hook (scripts/guards/seat-tools.mjs) - for that terminal only.
  assert.deepEqual([...SEAT_DENIED_TOOLS.claude], ['Agent', 'Task']);
  const env = envOf(t);
  const host = fakeHost();
  const out = await launch(env, host);
  assert.deepEqual(host.calls.bind, [out.terminal], 'the seat guard is bound to the seat terminal');
  assert.equal(host.calls.start[0].command, undefined, 'no command is composed for a worker-start seat');
  const root = tmp(t, 'starci-seat-guard-');
  const guard = path.join(root, 'runtime', 'guards', 'seats');
  fs.mkdirSync(guard, { recursive: true });
  fs.writeFileSync(path.join(guard, 'term_seat.json'), JSON.stringify({ role: 'supervisor', deniedTools: ['Agent', 'Task'] }));
  assert.match(seatToolDecision({ handle: 'term_seat', toolName: 'Agent', root })?.reason ?? '', /Agent is denied for the supervisor/);
  assert.equal(seatToolDecision({ handle: 'term_seat', toolName: 'Bash', root }), null, 'only the denied tools');
  assert.equal(seatToolDecision({ handle: 'term_other', toolName: 'Agent', root }), null, 'any other terminal passes untouched');
  assert.equal(seatToolDecision({ handle: null, toolName: 'Agent', root }), null, 'a session outside Orca passes untouched');
  const settings = JSON.parse(fs.readFileSync(new URL('../../.claude/settings.json', import.meta.url), 'utf8'));
  assert.match(JSON.stringify(settings.hooks.PreToolUse), /starci guard seat-tools/);
  const prompt = fs.readFileSync(new URL('../../modules/supervisor/supervisor-prompt.md', import.meta.url), 'utf8');
  assert.match(prompt, /Diagnosis is a \[Worker\] job too/);
  assert.match(fs.readFileSync(new URL('../../modules/supervisor/worker-prompt.md', import.meta.url), 'utf8'), /`diagnosed`/);
});

test('a diagnosis worker files outcome diagnosed; the watchdog announces it once with a [report] wake', (t) => {
  const env = envOf(t);
  const m = machineOf(t, env);
  const { job } = createJob(m, { cluster: 'diag', files: ['scripts/x.mjs'] });
  m.setSupJobStatus(job.job_id, 'running');
  assert.equal(fileReport(m, { jobId: job.job_id, outcome: 'diagnosed' }).ok, false, 'a diagnosis carries its findings');
  assert.ok(fileReport(m, { jobId: job.job_id, outcome: 'diagnosed', summary: 'root cause: x' }).ok);
  assert.equal(jobOf(m, job.job_id).status, 'succeeded');
  assert.equal(jobOf(m, job.job_id).result.reason, 'worker-diagnosed');
  const first = planWake({ now: Date.now(), lastTickAt: Date.now(), filed: [job.job_id] });
  assert.deepEqual(first.tags, ['report']);
  assert.deepEqual(planWake({ now: Date.now(), lastTickAt: Date.now(), filed: [job.job_id], wakes: [{ at: Date.now(), payload: { report: [job.job_id], text: first.text } }] }).tags, []);
});

test('ack consumes a decided diagnosis so no later [report] wake announces it again', (t) => {
  const env = envOf(t);
  const m = machineOf(t, env);
  const { job } = createJob(m, { cluster: 'stale-diag', files: ['scripts/y.mjs'] });
  m.setSupJobStatus(job.job_id, 'running');
  assert.ok(fileReport(m, { jobId: job.job_id, outcome: 'diagnosed', summary: 'root cause: y' }).ok);
  const unconsumed = () => m.supReports({ jobId: job.job_id, unconsumed: true }).length;
  assert.equal(unconsumed(), 1);
  assert.equal(ackReport(m, { jobId: job.job_id, reason: ' ' }).ok, false, 'an ack names its decision');
  assert.equal(ackReport(m, { jobId: job.job_id, reason: 'fix landed as abc123' }).ok, true);
  assert.equal(unconsumed(), 0, 'the watchdog filedReports query no longer sees it');
  assert.equal(ackReport(m, { jobId: job.job_id, reason: 'again' }).already, true);
  assert.equal(m.supEvents({ kind: 'worker-report-acked', entityId: job.job_id }).length, 1);
});

test('watchdog: a busy Supervisor (mid-turn, or idle input with subagents running) is never woken', async (t) => {
  const subagents = [
    '❯ Message @general-purpose…', '  ⏵⏵ bypass permissions on · 1 shell · ← for agents', '  ◯ main',
    '  ● general-purpose  Checking awaitSubmission import… 8m 41s · ↓ 154.0k tokens',
    '❯ ◯ general-purpose  Checking requiresProof keys in … 8m 37s · ↓ 146.7k tokens'].join('\n');
  assert.ok(busyScreen(subagents));
  assert.ok(!busyScreen('╭──╮\n❯ \n  ⏵⏵ bypass permissions on'), 'a plain idle prompt is not busy');
  assert.ok(!busyScreen('  ◯ main'), 'the main row alone is not a subagent');
  const env = envOf(t);
  const seed = await launch(env, fakeHost());
  appendInbox(SUPERVISOR_ID, { chatId: null, messageId: null, from: 'desktop', text: 'hi' }, { env });
  registerSupervisor({ id: SUPERVISOR_ID, label: 'S', terminal: seed.terminal }, { env });
  const woke = [];
  const d = (state, screen) => ({ show: () => ({ ok: true, state: 'ready' }), screen: () => screen, settleMs: 0, sleep: () => {},
    state: () => state, wake: (_t, text) => { woke.push(text); return { action: 'kernel-woken', delivered: true }; }, enter: () => ({ ok: true }),
    quit: () => null, close: () => ({ ok: true }), replace: () => assert.fail('never') });
  assert.equal((await watchdogPass({ env, d: d('active', '✽ Working…') })).action, 'busy');
  assert.equal((await watchdogPass({ env, d: d('turn-idle', subagents) })).state, 'subagents-running');
  assert.equal(woke.length, 0);
  assert.equal((await watchdogPass({ env, d: d('turn-idle', '❯ ') })).action, 'woken');
  assert.equal(woke.length, 1);
  const again = await watchdogPass({ env, d: d('turn-idle', '❯ ') });
  assert.notEqual(again.action, 'woken', 'the same unread message is not announced twice');
  assert.equal(woke.length, 1);
});

test('watchdog: a wake whose proof failed still counts, and an identical text is never sent twice', () => {
  const now = Date.now();
  const unread = [{ id: 'aaaaaaaa-1' }];
  const first = planWake({ now, lastTickAt: now, unread });
  assert.match(first.text, /new aaaaaaaa/);
  const failed = [{ at: now, payload: { inbox: ['aaaaaaaa-1'], delivered: false, text: first.text } }];
  assert.deepEqual(planWake({ now: now + 1000, lastTickAt: now, unread, wakes: failed }).tags, [], 'an undelivered attempt is still an announcement');
  const later = planWake({ now: now + 11 * 60_000, lastTickAt: now + 11 * 60_000, unread, wakes: failed });
  assert.match(later.text, /still unread aaaaaaaa/, 'a reminder names itself, so it is not the same text');
  assert.deepEqual(planWake({ now, lastTickAt: now - 11 * 60_000 }).tags, [], 'an old tick timestamp cannot wake the seat');
});

/* ------------------------------------------------------------ [Worker] terminals in the Orca sidebar */

test('a [Worker] starts through worker-start on its staging checkout, which Orca lists under the runtime project', async (t) => {
  const env = envOf(t);
  const m = machineOf(t, env);
  const { job } = createJob(m, { cluster: 'orca-tree', files: ['scripts/o.mjs'] });
  const spawned = [], bound = [];
  const root = path.join(os.tmpdir(), 'runtime-root');
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const r = await spawnWorkers(m, { settings, env, root, deps: {
    load: () => ({ cpuBusy: 0, freeMem: 1 }), route: async () => ({ pool: 'claude-agent', agent: 'claude', model: 'm' }),
    staging: ({ jobId }) => ({ ok: true, path: path.join(os.tmpdir(), 'staging', jobId), branch: `sup-${jobId}`, base: 'abc', orcaId: `repo::${jobId}` }),
    unstage: () => ({}), guard: () => ({ receipt: { jobFile: path.join(root, 'job.json') } }),
    bindGuard: (args) => { bound.push(args); return 'bound.json'; },
    start: (opts) => { spawned.push(opts); opts.onCreated?.('term_w1', 'ctx_w1'); return { ok: true, terminal: 'term_w1', dispatchId: 'ctx_w1', runId: 'run_w', taskId: 'task_w' }; } } });
  assert.equal(r.launched.length, 1);
  assert.equal(spawned[0].worktree, r.launched[0].staging, 'the worker starts on its staging checkout');
  assert.equal(spawned[0].title, '[Worker] orca-tree');
  assert.equal(spawned[0].cwd, undefined, 'no terminal is created elsewhere and changed into the checkout');
  assert.deepEqual(bound.map((b) => b.handle), ['term_w1'], 'the guard is bound to the worker terminal');
  assert.deepEqual([...openWorkerHandles(m)], ['term_w1']);
  assert.deepEqual([jobOf(m, job.job_id).payload.dispatch, jobOf(m, job.job_id).payload.runId], ['ctx_w1', 'run_w']);
});

test('a live [Worker] of an open job is owned: never a stray, orphan or [Supervisor] duplicate, never swept', async (t) => {
  const env = envOf(t);
  const sup = openMachine({ env });
  const { job } = createJob(sup, { cluster: 'kept', files: ['scripts/k.mjs'] });
  sup.startSupAttempt({ jobId: job.job_id, agent: 'claude', terminalHandle: 'term_wk' });
  sup.setSupJobStatus(job.job_id, 'running', { payload: { ...job.payload, dispatch: 'ctx_wk' } });
  const { job: done } = createJob(sup, { cluster: 'gone', files: ['scripts/g.mjs'] });
  sup.startSupAttempt({ jobId: done.job_id, agent: 'claude', terminalHandle: 'term_old' });
  sup.setSupJobStatus(done.job_id, 'succeeded');
  // The watchdog sweep leaves a live running worker alone.
  const d = { show: () => ({ ok: true, state: 'ready' }), close: () => assert.fail('a live worker of an open job is never closed'),
    stop: () => assert.fail('never stopped'), release: () => assert.fail('never released') };
  assert.deepEqual(sweepWorkers(sup, d), { deaths: [], closed: [] });
  sup.close();
  assert.deepEqual([...supervisorWorkerHandles({ env })].sort(), ['term_wk', 'term_old'].sort(), 'logical success retains a terminal whose physical closure remains unknown');
  // The Orca-tree check: the worker sits in the runtime project's worktree, its job in machine.sqlite sup_jobs.
  const repo = path.join(os.tmpdir(), 'starci-academy-backend', '.claude').replace(/\\/g, '/');
  withLedger(t, ({ ledger }) => {
    const rows = readTerminals([
      { handle: 'term_wk', title: '◐ Worker terminals orphaned in Orca', connected: true, worktreePath: repo },
      { handle: 'term_old', title: 'claude', connected: true, worktreePath: repo },
    ]);
    const findings = orcaTreeFindings(ledger.db, rows, { repo, owned: supervisorWorkerHandles({ env }) });
    assert.equal(findings.some((f) => f.terminal === 'term_wk'), false, JSON.stringify(findings));
    assert.equal(findings.some((f) => f.terminal === 'term_old'), false, 'a logically settled worker without closure proof remains owned, never stray');
  });
  // The seat dedupe keys on the seat record: a worker (whatever its titles say) is no seat session, so never a duplicate.
  const terminals = [
    { handle: 'term_seat', title: 'x', tab: '[Supervisor] main' },
    { handle: 'term_wk', title: 'reading [Supervisor] notes', tab: null },
    { handle: 'term_w2', title: '[Supervisor] x', tab: '[Worker] other' },
    { handle: 'term_dup', title: 'y', tab: '[Supervisor] main' },
  ];
  recordSeats(env, ['term_seat', 'term_dup']);
  const tabs = (_l, rows) => new Map(rows.map((r) => [r.handle, r.tab ?? null]));
  const marked = seatSessions({ terminals, visualLayouts: [] }, new Set(['term_seat', 'term_dup']), tabs);
  assert.deepEqual(marked.map((m) => m.handle), ['term_seat', 'term_dup']);
  const host = fakeHost({ terminals, live: new Set(['term_seat', 'term_wk', 'term_w2', 'term_dup']) });
  const out = await launch(env, host);
  assert.ok(!host.calls.close.includes('term_wk') && !host.calls.close.includes('term_w2'), JSON.stringify(host.calls.close));
  assert.equal(out.action, 'booted', out.action);
});

test('the push scan reads a diff file in chunks and keeps line numbers across chunk seams', async () => {
  const { diffScanner } = await import('../../scripts/supervisor/push-mains.mjs');
  const { forEachFileLine } = await import('../../scripts/lib/read-text.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-scan-spec-'));
  try {
    const file = path.join(dir, 'range.diff');
    const filler = Array.from({ length: 40 }, (_, i) => `+const row${i} = ${i};`).join('\n');
    fs.writeFileSync(file, `+++ b/src/config.ts\n@@ -0,0 +1,41 @@\n${filler}\n+const password = "Zq9Lk2Pw8Rt5Mn3Vb";\n`);
    const scanner = diffScanner(['src/config.ts']);
    forEachFileLine(file, (l) => scanner.line(l), { chunkBytes: 7 });
    assert.deepEqual(scanner.findings, [{ file: 'src/config.ts', line: 41, pattern: 'assigned-secret' }]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
