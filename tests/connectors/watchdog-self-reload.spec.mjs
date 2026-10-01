// A watchdog loop reloads itself when the runtime changes (scripts/machine/self-reload.mjs): the supervisor restarted
// all 9 kernel watchdogs by hand on 2026-09-25 because each loop kept the modules it had imported at start.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  createReloadWatch, reexecSelf, runtimeHead, moduleStamps, RELOAD_ENV, RELOAD_MIN_INTERVAL_MS,
} from '../../scripts/machine/self-reload.mjs';
import { rotateLog, LOG_CAP_BYTES } from '../../scripts/housekeeping/hk-logs.mjs';
import { claimOrTakeOver, claimManager, lockHolder, reassertManager } from '../../scripts/connectors/lib.mjs';
import { readMachine, withMachine } from '../../engine/db/machine.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHA_A = 'a'.repeat(40), SHA_B = 'b'.repeat(40), SHA_C = 'c'.repeat(40);
const MIN = 60_000;

/** A fake clock and a fake git whose HEAD the test moves. */
const fakes = (start = 1_000_000) => {
  const clock = { t: start };
  const git = { head: SHA_A, calls: 0 };
  const files = { '/rt/scripts/lib/terminal-liveness.mjs': 100 };
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
  g.files['/rt/scripts/lib/terminal-liveness.mjs'] = 200;
  const touched = byMtime.check();
  assert.equal(touched.reload, true, 'an uncommitted edit of the live checkout reloads too');
  assert.deepEqual(touched.changes, [{ kind: 'mtime', file: '/rt/scripts/lib/terminal-liveness.mjs', from: 100, to: 200 }]);
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

test('runtimeHead reads `git rev-parse HEAD` in <root> and refuses anything but a commit id', () => {
  const calls = [];
  const git = (args, opts) => { calls.push([opts.cwd, ...args]); return { status: 0, stdout: `${SHA_A}\n` }; };
  assert.equal(runtimeHead({ root: 'D:/rt', git }), SHA_A);
  assert.deepEqual(calls[0], ['D:/rt', 'rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);
  assert.equal(runtimeHead({ root: 'D:/rt', git: () => ({ status: 128, stdout: '' }) }), null);
  assert.equal(runtimeHead({ root: 'D:/rt', git: () => ({ status: 0, stdout: 'fatal: not a git repository' }) }), null);
  assert.equal(runtimeHead({ root: 'D:/rt', git: () => { throw new Error('ENOENT'); } }), null);
  assert.deepEqual(moduleStamps(['x', 'y'], { stat: (f) => { if (f === 'y') throw new Error('gone'); return { mtimeMs: 7 }; } }), { x: 7, y: null });
});

test('reexecSelf spawns the same argv, returns once the replacement holds the lock, and logs the handover', async () => {
  const f = fakes();
  const spawned = [], logged = [];
  let reads = 0;
  const r = await reexecSelf({
    script: '/rt/scripts/kernel/kernel-watchdog.mjs', args: ['--repo', 'D:/p', '--workflow', 'wf-1', '--repair'], actor: 'watchdog',
    lockName: 'kernel-watchdog-wf-1', env: { KEEP: '1' }, cwd: '/rt', now: f.now, selfPid: 4242,
    sleep: async (ms) => { f.clock.t += ms; },
    spawnChild: (spec) => { spawned.push(spec); return { pid: 5151, exited: () => false }; },
    holder: () => { reads += 1; return { pid: reads < 3 ? 4242 : 5151 }; },
    kill: () => assert.fail('a replacement that took over is never killed'),
    log: (row) => logged.push(row),
  });
  assert.deepEqual(r, { ok: true, pid: 5151 });
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].script, '/rt/scripts/kernel/kernel-watchdog.mjs');
  assert.deepEqual(spawned[0].args, ['--repo', 'D:/p', '--workflow', 'wf-1', '--repair'], 'the same argv, never --once');
  assert.equal(spawned[0].logFile, undefined, 'no text log: the loop logs to machine_logs itself');
  assert.equal(spawned[0].env.KEEP, '1');
  assert.equal(spawned[0].env[RELOAD_ENV.handoverFrom], '4242');
  assert.equal(spawned[0].env[RELOAD_ENV.reloadedAt], String(1_000_000));
  assert.equal(logged.length, 1);
  assert.deepEqual([logged[0].actor, logged[0].kind, logged[0].level, logged[0].data.lockName, logged[0].data.pid], ['watchdog', 'self-reload.handover', 'info', 'kernel-watchdog-wf-1', 5151]);
});

test('a replacement that never takes the lock is stopped and the lock stays with the running loop', async () => {
  const f = fakes();
  const killed = [], reclaimed = [], logged = [];
  const log = (row) => logged.push(row);
  let lock = { pid: 4242 };
  const r = await reexecSelf({
    script: 's', lockName: 'L', now: f.now, selfPid: 4242, waitMs: 30_000, log,
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
  assert.equal(logged.at(-1).level, 'warn');

  // The replacement took the lock just as the wait ran out: it is killed and the lock is taken back.
  lock = { pid: 4242 };
  let reads = 0;
  const late = await reexecSelf({
    script: 's', lockName: 'L', now: f.now, selfPid: 4242, waitMs: 1_000, pollMs: 500, log,
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
    script: 's', lockName: 'L', now: f.now, selfPid: 4242, log,
    sleep: async (ms) => { f.clock.t += ms; },
    spawnChild: () => ({ pid: 7171, exited: () => true }),
    holder: () => ({ pid: 4242 }), kill: () => {}, reclaim: () => {},
  });
  assert.match(dead.error, /exited before taking the lock/);
  assert.equal(f.clock.t, t0);
  assert.equal((await reexecSelf({ script: 's', lockName: 'L', log, spawnChild: () => { throw new Error('EPERM'); } })).ok, false);
});

test('the singleton host lock is handed over, never freed: only the named predecessor\'s lock can be taken over', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-reload-lock-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { LOCALAPPDATA: dir, STARCI_TEST_MACHINE_FILE: path.join(dir, 'machine.sqlite') };
  const name = 'kernel-watchdog-wf-handover';
  // The running loop: a live process (this test's parent) holds the lock.
  const predecessor = process.ppid, at = Date.now();
  withMachine((m) => m.upsert('host_locks', { name, holder_pid: predecessor, holder: 'watchdog.mjs', started_at: at, heartbeat_at: at, expires_at: at + 600_000, state: 'held' }, ['name']), { env });
  assert.equal(claimManager(name, { env }).ok, false, 'a plain claim is refused while the loop lives');
  assert.equal(claimOrTakeOver(name, { from: 999_999_999, env }).ok, false, 'a replacement of another loop is refused');
  assert.equal(claimOrTakeOver(name, { from: null, env }).ok, false);
  const took = claimOrTakeOver(name, { from: String(predecessor), env });
  assert.equal(took.ok, true);
  assert.equal(took.takenOver, true);
  const row = withMachine((m) => m.hostLock(name), { env });
  assert.deepEqual([row.holder_pid, row.handed_over_from, row.state], [process.pid, predecessor, 'held']);
  assert.equal(lockHolder(name, env).pid, process.pid);
  took.release();
  assert.equal(withMachine((m) => m.hostLock(name), { env }).state, 'released', 'the new holder releases it normally');
});

test('a real re-exec: the replacement takes the host lock over from the spawning loop, and the handover is logged', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-reload-e2e-'));
  const env = { ...process.env, LOCALAPPDATA: dir, STARCI_TEST_MACHINE_FILE: path.join(dir, 'machine.sqlite') };
  delete env.NODE_TEST_CONTEXT;
  const name = 'kernel-watchdog-wf-e2e';
  const held = claimManager(name, { env });
  assert.equal(held.ok, true);
  const script = path.join(dir, 'fake-loop.mjs'), out = path.join(dir, 'replacement.txt');
  const lib = pathToFileURL(path.join(ROOT, 'scripts', 'connectors', 'lib.mjs')).href;
  fs.writeFileSync(script, `import fs from 'node:fs';
import { claimOrTakeOver } from ${JSON.stringify(lib)};
const held = claimOrTakeOver(${JSON.stringify(name)}, { from: process.env.${RELOAD_ENV.handoverFrom} });
fs.appendFileSync(${JSON.stringify(out)}, 'replacement ' + process.pid + ' args=' + process.argv.slice(2).join(' ') + ' took=' + held.ok + '\\n');
setTimeout(() => { held.release?.(); process.exit(0); }, held.ok ? 20000 : 0);
`);
  const r = await reexecSelf({ script, args: ['--workflow', 'wf-e2e', '--repair'], lockName: name, env, cwd: os.tmpdir(), waitMs: 20_000, actor: 'watchdog',
    holder: (n) => lockHolder(n, env), reclaim: (n) => reassertManager(n, { env }) });
  t.after(() => { try { process.kill(r.pid); } catch { /* gone */ } try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }); } catch { /* the killed child's handle closes late on Windows */ } });
  assert.equal(r.ok, true, r.error);
  assert.equal(lockHolder(name, env).pid, r.pid);
  held.release();
  assert.equal(lockHolder(name, env).pid, r.pid, 'the old loop\'s release never frees a lock it handed over');
  for (let i = 0; i < 50 && !fs.existsSync(out); i += 1) await new Promise((res) => setTimeout(res, 100));
  assert.match(fs.readFileSync(out, 'utf8'), new RegExp(`replacement ${r.pid} args=--workflow wf-e2e --repair took=true`));
  const [row] = readMachine((m) => m.logs({ actor: 'watchdog', kind: 'self-reload.handover' }), [], { env });
  assert.equal(row?.data?.pid, r.pid);
  assert.equal(row?.data?.lockName, name);
});

test('rotateLog moves a text log past its cap to <log>.1 and leaves a smaller one', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-reload-rotate-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const log = path.join(dir, 'wf-1.log');
  fs.writeFileSync(log, Buffer.alloc(LOG_CAP_BYTES + 1, 'x'));
  assert.equal(rotateLog(log), log);
  assert.equal(fs.existsSync(log), false);
  assert.equal(fs.statSync(`${log}.1`).size, LOG_CAP_BYTES + 1, 'the full log moved to <log>.1');
  const small = path.join(dir, 'small.log');
  fs.writeFileSync(small, 'keep\n');
  assert.equal(rotateLog(small), small);
  assert.equal(fs.readFileSync(small, 'utf8'), 'keep\n', 'a log under the cap stays');
});
