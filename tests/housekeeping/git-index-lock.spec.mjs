// git-index-lock: a stale shared .git/index.lock (a 403 KB lock
// from 01:01:34, no git process alive, every commit in the checkout refused) is recovered by the runtime, only when
// it is older than allocation.housekeeping.gitIndexLockStaleMs and no git process may be working on that repository;
// each removal is a Supervisor audit event (machine.sqlite sup_events). The op command guard (before an op's git command) and the housekeeping area gitlocks run it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { indexLock } from '../../scripts/api/git/index-lock.mjs';
import { preflightIndexLock, LOCK_EVENT } from '../../scripts/machine/lock-recovery.mjs';
import { processOnRepo, reposNamed, gitDirOf, checkoutOf } from '../../scripts/lib/git-dir.mjs';
import { sweepGitLocks } from '../../scripts/housekeeping/hk-git-locks.mjs';
import { AREAS } from '../../scripts/housekeeping/housekeeping.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { readMachine } from '../../engine/db/machine.mjs';
import { writeJobGuard, bindGuardTerminal } from '../../scripts/guards/hook-install.mjs';

const MIN = 60_000;
const STALE = 5 * MIN;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const tmp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-gitlock-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }));
  return dir;
};
/** A checkout with a .git directory and an index lock `ageMin` old. */
const repoWithLock = (t, ageMin) => {
  const repo = path.join(tmp(t), 'repo');
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'src', 'deep'), { recursive: true });
  const lock = path.join(repo, '.git', 'index.lock');
  fs.writeFileSync(lock, 'x'.repeat(403));
  const at = new Date(Date.now() - ageMin * MIN);
  fs.utimesSync(lock, at, at);
  return { repo, lock };
};
const proc = (commandLine, name = 'git.exe') => ({ pid: 4242, name, commandLine });

test('runtimes.yaml declares the stale window and housekeeping runs the gitlocks area', () => {
  assert.ok(Number(allocationSettings().housekeeping.gitIndexLockStaleMs) > 0);
  assert.deepEqual(AREAS.gitlocks, { module: './hk-git-locks.mjs', sweep: 'sweepGitLocks' });
});

test('a git process holds the repo when it names it or names none; one naming only another repo does not', () => {
  const repo = path.resolve('D:/Repositories/ecommerce-app');
  assert.deepEqual(reposNamed('"C:\\Program Files\\Git\\cmd\\git.exe" -C "D:\\Repositories\\ecommerce-app" status'), ['D:\\Repositories\\ecommerce-app']);
  assert.deepEqual(reposNamed('git --git-dir=/r/.git --work-tree /r log'), ['/r/.git', '/r']);
  assert.equal(processOnRepo(proc('git.exe -C D:/Repositories/ecommerce-app commit -m x'), repo), 'this');
  assert.equal(processOnRepo(proc('git.exe -C D:/Repositories/ecommerce-app/src add a'), repo), 'this');
  assert.equal(processOnRepo(proc('git.exe --git-dir=D:/Repositories/ecommerce-app/.git status'), repo), 'this');
  assert.equal(processOnRepo(proc('git.exe -C D:/Repositories/todo-app-be status'), repo), 'other');
  assert.equal(processOnRepo(proc('git.exe commit -m x'), repo), 'unknown', 'its cwd may be this repo');
});

test('a lock younger than the window, or a git process that may hold it, keeps the lock', (t) => {
  const { repo, lock } = repoWithLock(t, 2);
  assert.equal(indexLock({ repo, staleMs: STALE, list: () => [] }).state, 'fresh');
  const old = repoWithLock(t, 9);
  const held = indexLock({ repo: old.repo, staleMs: STALE, list: () => [proc('git.exe commit -m wip')] });
  assert.equal(held.state, 'held');
  assert.equal(held.holders[0].pid, 4242);
  assert.equal(indexLock({ repo: old.repo, staleMs: STALE, list: () => [proc(`git.exe -C ${old.repo} add x`)] }).state, 'held');
  assert.equal(indexLock({ repo: old.repo, staleMs: STALE, list: () => null }).state, 'probe-failed', 'an unread process table removes nothing');
  assert.equal(indexLock({ repo: old.repo, staleMs: STALE }).state, 'probe-failed', 'a spec never reads the host process table');
  assert.ok(fs.existsSync(lock) && fs.existsSync(old.lock));
});

test('a lock that changed during the probe stays; a dry run only reports', (t) => {
  const { repo, lock } = repoWithLock(t, 9);
  const touched = indexLock({ repo, staleMs: STALE, list: () => { fs.appendFileSync(lock, 'y'); return []; } });
  assert.equal(touched.state, 'changed');
  assert.equal(indexLock({ repo, staleMs: STALE, list: () => [], apply: false }).state, 'fresh', 'the rewrite made it young again');
  const at = new Date(Date.now() - 9 * MIN);
  fs.utimesSync(lock, at, at);
  assert.equal(indexLock({ repo, staleMs: STALE, apply: false, list: () => [] }).state, 'would-remove');
  assert.ok(fs.existsSync(lock));
});

test('a stale lock with no git process on the repository is removed and recorded once', (t) => {
  const { repo, lock } = repoWithLock(t, 9);
  const recorded = [];
  const r = indexLock({ repo, staleMs: STALE, list: () => [proc('git.exe -C D:/elsewhere status'), proc('node.exe x', 'node.exe')].filter((p) => /^git/.test(p.name)), record: (x) => recorded.push(x) });
  assert.equal(r.state, 'removed');
  assert.equal(fs.existsSync(lock), false);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].bytes, 403);
});

test('a linked worktree resolves its gitdir; the checkout of a nested cwd is found', (t) => {
  const dir = tmp(t);
  const gitdir = path.join(dir, 'main', '.git', 'worktrees', 'w');
  fs.mkdirSync(gitdir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'w', 'a'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'w', '.git'), `gitdir: ${gitdir}\n`);
  assert.equal(gitDirOf(path.join(dir, 'w')), gitdir);
  assert.equal(checkoutOf(path.join(dir, 'w', 'a')), path.join(dir, 'w'));
});

test('the command guard pre-flight removes a stale lock and records git-index-lock-removed in machine.sqlite', async (t) => {
  const { repo, lock } = repoWithLock(t, 9);
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(tmp(t), 'machine.sqlite') };
  const said = [];
  const r = await preflightIndexLock({ cwd: path.join(repo, 'src', 'deep'), guard: { jobId: 'op-backend.implement-aaaaaaaaaa', workflowId: 'wf-x' }, env, say: (l) => said.push(l), list: () => [] });
  assert.equal(r.state, 'removed');
  assert.equal(fs.existsSync(lock), false);
  assert.match(said.join('\n'), /removed a stale .*index\.lock/);
  const rows = readMachine((m) => m.supEvents({ kind: LOCK_EVENT }), [], { env });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].payload.jobId, 'op-backend.implement-aaaaaaaaaa');
  assert.equal(rows[0].payload.by, 'command-guard');
  assert.equal(await preflightIndexLock({ cwd: repo, env, list: () => [] }), null, 'no lock: one stat, nothing else');
});

test('the command guard runs the pre-flight before an op\'s git command and says why a lock stays', (t) => {
  const { repo, lock } = repoWithLock(t, 9);
  spawnSync('git', ['init', '-q'], { cwd: repo, windowsHide: true });
  const jobFile = writeJobGuard({ skillRoot: tmp(t), jobId: 'op-backend.implement-bbbbbbbbbb', workflowId: 'wf-x', ledgerRepo: null, owned: [repo] });
  const handle = `term_spec-index-lock-${process.pid}`;
  const bound = bindGuardTerminal({ skillRoot: root, handle, jobFile });
  t.after(() => fs.rmSync(bound, { force: true }));
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'guards', 'command-guard.mjs')], { encoding: 'utf8', windowsHide: true,
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git status --porcelain' }, cwd: repo }),
    env: { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(tmp(t), 'machine.sqlite'), ORCA_TERMINAL_HANDLE: handle } });
  assert.equal(r.status, 0, 'the command itself is allowed');
  assert.match(r.stderr, /index\.lock is \d+ min old and was left in place \(probe-failed/, 'a spec child never reads the host table, and says so');
  assert.ok(fs.existsSync(lock));
});

test('housekeeping gitlocks sweeps each product checkout: dry run reports, apply removes', async (t) => {
  const a = repoWithLock(t, 9), b = repoWithLock(t, 1);
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(tmp(t), 'machine.sqlite') };
  const allocation = { housekeeping: { gitIndexLockStaleMs: STALE } };
  const dry = await sweepGitLocks({ apply: false, env, allocation, repos: [a.repo, b.repo], list: () => [] });
  assert.equal(dry.ok, true);
  assert.deepEqual(dry.skipped.map((s) => s.reason), ['would-remove']);
  assert.ok(fs.existsSync(a.lock));
  const done = await sweepGitLocks({ apply: true, env, allocation, repos: [a.repo, b.repo], list: () => [] });
  assert.deepEqual(done.deleted, [a.lock]);
  assert.ok(!fs.existsSync(a.lock) && fs.existsSync(b.lock));
  assert.equal((await sweepGitLocks({ apply: true, env, allocation: {}, repos: [] })).ok, false, 'no declared window: refuse');
});
