// A watchdog loop reloads itself when the runtime changes (scripts/lib/self-reload.mjs): the supervisor restarted
// all 9 kernel watchdogs by hand on 2026-09-25 because each loop kept the modules it had imported at start.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  createReloadWatch, reexecSelf, runtimeHead, moduleStamps, RELOAD_ENV, RELOAD_MIN_INTERVAL_MS,
} from '../scripts/lib/self-reload.mjs';
import { claimOrTakeOver, claimManager, lockHolder, stateFile } from '../scripts/connectors/lib.mjs';
import { runWatchdogLoop, watchdogLockName, reloadWatchedFiles } from '../scripts/kernel/watchdog.mjs';
import { runLoop } from '../scripts/supervisor/watchdog.mjs';
import { watchdogLogFile } from '../scripts/kernel/resume-all.mjs';
import { watchdogLogFile as sharedLogFile } from '../scripts/kernel/watchdog-log.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA_A = 'a'.repeat(40), SHA_B = 'b'.repeat(40), SHA_C = 'c'.repeat(40);
const MIN = 60_000;

/** A fake clock and a fake git whose HEAD the test moves. */
const fakes = (start = 1_000_000) => {
  const clock = { t: start };
  const git = { head: SHA_A, calls: 0 };
  const files = { '/rt/scripts/kernel/terminal-liveness.mjs': 100 };
  return {
    clock, git, files,
    now: () => clock.t,
    head: () => { git.calls += 1; return git.head; },
    stamps: () => ({ ...files }),
  };
};

test('the reload watch fires on a new runtime HEAD and on a changed module mtime', () => {
  const f = fakes();
  const watch = createReloadWatch({ head: f.head, stamps: f.stamps, now: f.now });
  assert.equal(watch.baseline.head, SHA_A);
  assert.deepEqual(watch.check(), { reload: false, reason: null, changes: [] }, 'nothing changed');
  f.git.head = SHA_B;
  const moved = watch.check();
  assert.equal(moved.reload, true);
  assert.match(moved.reason, /runtime HEAD aaaaaaaaa -> bbbbbbbbb/);
  assert.equal(f.git.calls, 3, 'git is asked once per check, plus the baseline');

  const g = fakes();
  const byMtime = createReloadWatch({ head: g.head, stamps: g.stamps, now: g.now });
  g.files['/rt/scripts/kernel/terminal-liveness.mjs'] = 200;
  const touched = byMtime.check();
  assert.equal(touched.reload, true, 'an uncommitted edit of the live checkout reloads too');
  assert.deepEqual(touched.changes, [{ kind: 'mtime', file: '/rt/scripts/kernel/terminal-liveness.mjs', from: 100, to: 200 }]);
});

test('restart-storm guard: at most one reload per 5 minutes, and a change inside the window stays pending', () => {
  const f = fakes();
  const watch = createReloadWatch({ head: f.head, stamps: f.stamps, now: f.now });
  f.git.head = SHA_B;
  assert.equal(watch.check().reload, true);
  watch.markAttempt();
  // The attempt failed (the loop kept running) and main moved again one minute later.
  f.clock.t += MIN;
  f.git.head = SHA_C;
  const early = watch.check();
  assert.equal(early.reload, false);
  assert.equal(early.deferred, true);
  assert.equal(early.pendingMs, RELOAD_MIN_INTERVAL_MS - MIN);
  f.clock.t += RELOAD_MIN_INTERVAL_MS - MIN - 1;
  assert.equal(watch.check().reload, false, 'still one millisecond inside the window');
  f.clock.t += 1;
  assert.equal(watch.check().reload, true, 'the pending change reloads once the window opens');
});

test('the guard crosses the re-exec: a replacement started by a reload waits a full interval from that reload', () => {
  const f = fakes();
  // RELOAD_ENV.reloadedAt carried the parent's reload time: 2 minutes ago.
  const watch = createReloadWatch({ head: f.head, stamps: f.stamps, now: f.now, lastReloadAt: f.clock.t - 2 * MIN });
  f.git.head = SHA_B;
  assert.equal(watch.check().deferred, true);
  f.clock.t += 3 * MIN;
  assert.equal(watch.check().reload, true);
  // A loop started by hand (no reload behind it) reloads at once.
  const g = fakes();
  const fresh = createReloadWatch({ head: g.head, stamps: g.stamps, now: g.now });
  g.git.head = SHA_B;
  assert.equal(fresh.check().reload, true);
});

test('an unanswered git is no change; a baseline read while git was down is taken from its first answer', () => {
  const f = fakes();
  f.git.head = null;
  const watch = createReloadWatch({ head: f.head, stamps: f.stamps, now: f.now });
  assert.equal(watch.baseline.head, null);
  f.git.head = SHA_A;
  assert.equal(watch.check().reload, false, 'the first answer becomes the baseline');
  f.git.head = null;
  assert.equal(watch.check().reload, false, 'a git that stops answering is not a change');
  f.git.head = SHA_B;
  assert.equal(watch.check().reload, true);
});

test('runtimeHead reads `git -C <root> rev-parse HEAD` and refuses anything but a commit id', () => {
  const calls = [];
  const run = (cmd, args) => { calls.push([cmd, ...args]); return { status: 0, stdout: `${SHA_A}\n` }; };
  assert.equal(runtimeHead({ root: 'D:/rt', run }), SHA_A);
  assert.deepEqual(calls[0], ['git', '-C', 'D:/rt', 'rev-parse', 'HEAD']);
  assert.equal(runtimeHead({ root: 'D:/rt', run: () => ({ status: 128, stdout: '' }) }), null);
  assert.equal(runtimeHead({ root: 'D:/rt', run: () => ({ status: 0, stdout: 'fatal: not a git repository' }) }), null);
  assert.equal(runtimeHead({ root: 'D:/rt', run: () => { throw new Error('ENOENT'); } }), null);
  assert.deepEqual(moduleStamps(['x', 'y'], { stat: (f) => { if (f === 'y') throw new Error('gone'); return { mtimeMs: 7 }; } }), { x: 7, y: null });
});

test('reexecSelf spawns the same argv into the same log, then returns once the replacement holds the lock', async () => {
  const f = fakes();
  const spawned = [];
  let reads = 0;
  const r = await reexecSelf({
    script: '/rt/scripts/kernel/watchdog.mjs', args: ['--repo', 'D:/p', '--workflow', 'wf-1', '--repair'], logFile: '/logs/wf-1.log',
    lockName: 'kernel-watchdog-wf-1', env: { KEEP: '1' }, cwd: '/rt', now: f.now, selfPid: 4242,
    sleep: async (ms) => { f.clock.t += ms; },
    spawnChild: (spec) => { spawned.push(spec); return { pid: 5151, exited: () => false }; },
    holder: () => { reads += 1; return { pid: reads < 3 ? 4242 : 5151 }; },
    kill: () => assert.fail('a replacement that took over is never killed'),
  });
  assert.deepEqual(r, { ok: true, pid: 5151 });
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].script, '/rt/scripts/kernel/watchdog.mjs');
  assert.deepEqual(spawned[0].args, ['--repo', 'D:/p', '--workflow', 'wf-1', '--repair'], 'the same argv, never --once');
  assert.equal(spawned[0].logFile, '/logs/wf-1.log');
  assert.equal(spawned[0].env.KEEP, '1');
  assert.equal(spawned[0].env[RELOAD_ENV.handoverFrom], '4242');
  assert.equal(spawned[0].env[RELOAD_ENV.reloadedAt], String(1_000_000));
});

test('a replacement that never takes the lock is stopped and the lock stays with the running loop', async () => {
  const f = fakes();
  const killed = [], reclaimed = [];
  let lock = { pid: 4242 };
  const r = await reexecSelf({
    script: 's', lockName: 'L', now: f.now, selfPid: 4242, waitMs: 30_000,
    sleep: async (ms) => { f.clock.t += ms; },
    spawnChild: () => ({ pid: 5151, exited: () => false }),
    holder: () => lock,
    kill: (pid) => killed.push(pid),
    reclaim: (name) => reclaimed.push(name),
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /did not take the lock L within 30000ms/);
  assert.deepEqual(killed, [5151]);
  assert.deepEqual(reclaimed, [], 'the lock still names this loop: nothing to take back');

  // The replacement took the lock just as the wait ran out: it is killed and the lock is taken back.
  lock = { pid: 4242 };
  let reads = 0;
  const late = await reexecSelf({
    script: 's', lockName: 'L', now: f.now, selfPid: 4242, waitMs: 1_000, pollMs: 500,
    sleep: async (ms) => { f.clock.t += ms; },
    spawnChild: () => ({ pid: 6161, exited: () => false }),
    holder: () => { reads += 1; return reads <= 3 ? { pid: 4242 } : { pid: 6161 }; },
    kill: (pid) => killed.push(pid),
    reclaim: (name) => reclaimed.push(name),
  });
  assert.equal(late.ok, false);
  assert.deepEqual(reclaimed, ['L']);

  // A replacement that dies at once fails fast, without waiting out the handover window.
  const t0 = f.clock.t;
  const dead = await reexecSelf({
    script: 's', lockName: 'L', now: f.now, selfPid: 4242,
    sleep: async (ms) => { f.clock.t += ms; },
    spawnChild: () => ({ pid: 7171, exited: () => true }),
    holder: () => ({ pid: 4242 }), kill: () => {}, reclaim: () => {},
  });
  assert.match(dead.error, /exited before taking the lock/);
  assert.equal(f.clock.t, t0);
  assert.equal((await reexecSelf({ script: 's', lockName: 'L', spawnChild: () => { throw new Error('EPERM'); } })).ok, false);
});

test('the singleton lock is handed over, never freed: only the named predecessor\'s lock can be taken over', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-reload-lock-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { LOCALAPPDATA: dir };
  const name = 'kernel-watchdog-wf-handover';
  const file = stateFile(`${name}.lock`, env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // The running loop: a live process (this test's parent) holds the lock.
  const predecessor = process.ppid;
  fs.writeFileSync(file, JSON.stringify({ pid: predecessor, startedAt: new Date().toISOString() }));
  assert.equal(claimManager(name, { env }).ok, false, 'a plain claim is refused while the loop lives');
  assert.equal(claimOrTakeOver(name, { from: 999_999_999, env }).ok, false, 'a replacement of another loop is refused');
  assert.equal(claimOrTakeOver(name, { from: null, env }).ok, false);
  const took = claimOrTakeOver(name, { from: String(predecessor), env });
  assert.equal(took.ok, true);
  assert.equal(took.takenOver, true);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(record.pid, process.pid);
  assert.equal(record.handedOverFrom, predecessor);
  assert.equal(lockHolder(name, env).pid, process.pid);
  took.release();
  assert.equal(fs.existsSync(file), false, 'the new holder releases it normally');
  assert.equal(watchdogLockName('wf:odd/id'), 'kernel-watchdog-wf_odd_id');
});

test('a real re-exec: the replacement appends to the same log and takes the lock over from the spawning loop', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-reload-e2e-'));
  const env = { ...process.env, LOCALAPPDATA: dir };
  delete env.NODE_TEST_CONTEXT;
  const name = 'kernel-watchdog-wf-e2e';
  const held = claimManager(name, { env });
  assert.equal(held.ok, true);
  const script = path.join(dir, 'fake-loop.mjs');
  const lib = pathToFileURL(path.join(ROOT, 'scripts', 'connectors', 'lib.mjs')).href;
  fs.writeFileSync(script, `import { claimOrTakeOver } from ${JSON.stringify(lib)};
const held = claimOrTakeOver(${JSON.stringify(name)}, { from: process.env.${RELOAD_ENV.handoverFrom} });
console.log('replacement ' + process.pid + ' args=' + process.argv.slice(2).join(' ') + ' took=' + held.ok);
setTimeout(() => { held.release?.(); process.exit(0); }, held.ok ? 20000 : 0);
`);
  const log = path.join(dir, 'wf-e2e.log');
  fs.writeFileSync(log, 'first generation line\n');
  const r = await reexecSelf({ script, args: ['--workflow', 'wf-e2e', '--repair'], logFile: log, lockName: name, env, cwd: os.tmpdir(), waitMs: 20_000 });
  t.after(() => { try { process.kill(r.pid); } catch { /* gone */ } try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }); } catch { /* the killed child's log handle closes late on Windows */ } });
  assert.equal(r.ok, true, r.error);
  assert.equal(lockHolder(name, env).pid, r.pid);
  held.release();
  assert.equal(lockHolder(name, env).pid, r.pid, 'the old loop\'s release never frees a lock it handed over');
  for (let i = 0; i < 50 && !/replacement/.test(fs.readFileSync(log, 'utf8')); i += 1) await new Promise((res) => setTimeout(res, 100));
  const text = fs.readFileSync(log, 'utf8');
  assert.match(text, /^first generation line\n/, 'the log is appended, not truncated');
  assert.match(text, new RegExp(`replacement ${r.pid} args=--workflow wf-e2e --repair took=true`));
});

test('the kernel watchdog loop reloads between ticks and exits only once the replacement holds the lock', async () => {
  const f = fakes();
  const watch = createReloadWatch({ head: f.head, stamps: f.stamps, now: f.now });
  const printed = [];
  let ticks = 0;
  const tick = () => { ticks += 1; if (ticks === 2) f.git.head = SHA_B; return { ok: true, workflowId: 'wf-1', action: 'active' }; };
  const r = await runWatchdogLoop({ workflow: 'wf-1', tick, print: (x) => printed.push(x), sleep: async (ms) => { f.clock.t += ms; }, interval: 300_000,
    watch, reload: async (check) => { assert.match(check.reason, /runtime HEAD/); return { ok: true, pid: 5151 }; }, maxIterations: 10 });
  assert.deepEqual(r, { exitCode: 0, reloaded: 5151 });
  assert.equal(ticks, 2, 'the reload comes after the tick that saw main move, before the next one');
  assert.deepEqual(printed.at(-1), { ok: true, workflowId: 'wf-1', action: 'reloaded', reason: `runtime HEAD aaaaaaaaa -> bbbbbbbbb`, replacementPid: 5151 });

  // A failed handover keeps the loop ticking, and the guard holds the next attempt for 5 minutes.
  const g = fakes();
  const watch2 = createReloadWatch({ head: g.head, stamps: g.stamps, now: g.now });
  g.git.head = SHA_B;
  let attempts = 0;
  const kept = await runWatchdogLoop({ workflow: 'wf-2', tick: () => ({ ok: true, workflowId: 'wf-2', action: 'idle-waiting' }), print: () => {},
    sleep: async (ms) => { g.clock.t += ms; }, interval: 60_000, watch: watch2,
    reload: async () => { attempts += 1; return { ok: false, pid: 9, error: 'no lock' }; }, maxIterations: 7 });
  assert.deepEqual(kept, { exitCode: 0 });
  assert.equal(attempts, 2, 'one attempt at minute 1, the next at minute 6, none between');

  // A finished workflow ends the loop without a reload check.
  const done = await runWatchdogLoop({ workflow: 'wf-3', tick: () => ({ ok: true, workflowId: 'wf-3', action: 'finished' }), print: () => {},
    sleep: async () => assert.fail('no sleep after finished'), watch: { check: () => assert.fail('no check after finished') }, reload: async () => ({ ok: true }) });
  assert.deepEqual(done, { exitCode: 0, finished: true });
});

test('the kernel loop watches its own modules and the cards; its log is the one resume-all starts it with', () => {
  const files = reloadWatchedFiles(ROOT).map((file) => path.relative(ROOT, file).split(path.sep).join('/'));
  for (const rel of ['scripts/kernel/watchdog.mjs', 'scripts/kernel/terminal-liveness.mjs', 'scripts/kernel/wake-delivery.mjs', 'scripts/kernel/host-outage.mjs',
    'modules/models/runtimes.yaml', 'modules/models/agents/claude.yaml']) assert.ok(files.includes(rel), rel);
  for (const rel of files) assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} exists`);
  const env = { LOCALAPPDATA: 'C:/x' };
  assert.equal(watchdogLogFile('wf:1', env), sharedLogFile('wf:1', env));
  assert.equal(path.basename(sharedLogFile('wf:1', env)), 'wf_1.log');
});

test('the supervisor watchdog loop reloads the same way and hands its lock over', async () => {
  const f = fakes();
  const watch = createReloadWatch({ head: f.head, stamps: f.stamps, now: f.now });
  const lines = [];
  let released = 0, passes = 0;
  const r = await runLoop({
    claim: () => ({ ok: true, release: () => { released += 1; } }), standDown: () => null, log: (line) => lines.push(line),
    pass: async () => { passes += 1; if (passes === 3) f.git.head = SHA_B; return f.now(); },
    sleep: async (ms) => { f.clock.t += ms; }, watch, reload: async () => ({ ok: true, pid: 8181 }), maxIterations: 10,
  });
  assert.deepEqual(r, { reloaded: 8181 });
  assert.equal(passes, 3);
  assert.ok(lines.some((line) => /reloaded: pid 8181 took over \(runtime HEAD aaaaaaaaa -> bbbbbbbbb\)/.test(line)), lines.join('\n'));
  assert.ok(released >= 1, 'release runs, and is a no-op once the lock names the replacement');
});
