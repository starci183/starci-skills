import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { classifyGit, envConfig, pathspecsWithinOwned, parsePathspecList, PATHSPEC_LIST_COMMIT } from '../scripts/guards/git-policy.mjs';
import { classifyNpm, acquireDepsLock, peerLeasedJobs } from '../scripts/guards/deps-guard.mjs';
import { ensureGuardBin, ensureHistoryHook, writeJobGuard, historyHookBody, guardLaunch } from '../scripts/guards/install.mjs';

// nivo, 2026-09-23/24: four workflows share nivo-backend main. A Collab worker ran
// `git reset --soft HEAD~1` over the workspace-provision commit 1ed65948 (inc-40fed684fff8,
// inc-cb721b99fdd1), a commit swept a hook-restaged foreign file (inc-5d7ce049e810), and
// node_modules was deleted and recreated under running checks (inc-7faca0d4d632,
// inc-3de1d5efdea6). scripts/guards/ refuses those in front of the worker (shims) and in
// git itself (reference-transaction hook).

const ROOT = path.resolve(import.meta.dirname, '..');
const refused = (argv, ctx) => classifyGit(argv, ctx);

test('history-rewriting git is refused; append-only git passes', () => {
  for (const argv of [
    ['reset', '--soft', 'HEAD~1'], ['reset', '--hard'], ['reset', '--hard', 'HEAD'], ['reset'], ['reset', 'HEAD~1'],
    ['rebase', 'main'], ['rebase', '-i', 'HEAD~3'], ['pull', '--rebase'], ['commit', '--amend', '--no-edit'],
    ['commit', '--fixup=amend:HEAD', '-m', 'x', '--', 'a'], ['stash'], ['stash', 'push', '-m', 'x'], ['stash', 'pop'],
    ['clean', '-fd'], ['clean', '-f', '-d'], ['clean', '--force'], ['checkout', 'main'], ['checkout', '-b', 'x'],
    ['checkout', 'src/x.ts'], ['switch', 'dev'], ['branch', '-D', 'main'], ['branch', '-f', 'main', 'HEAD~1'],
    ['push', '--force'], ['push', 'origin', '+main'], ['push', '--force-with-lease'], ['update-ref', 'refs/heads/main', 'HEAD~1'],
    ['filter-branch'], ['reflog', 'expire', '--all'], ['-c', 'core.hooksPath=.nohooks', 'commit', '-m', 'x', '--', 'a'],
    ['-C', 'sub', 'reset', '--soft', 'HEAD^'], ['commit', '-m', 'x'], ['commit', '-am', 'x'], ['commit', '-a', '-m', 'x'],
    ['commit', '--no-verify', '-m', 'x', '--', 'a'], ['add', '-A'], ['add', '--all'], ['add', '-u'],
    // hooks switched off for a hooked write, however the config arrives (inline, --config-env)
    ['-c', 'core.hooksPath=NUL', '-c', 'core.fsmonitor=false', 'commit', '-m', 'x', '--', 'a'], ['-c', 'core.hooksPath=NUL', 'reset', '--hard'],
    ['--config-env=core.hooksPath=HOOKS', 'commit', '-m', 'x', '--', 'a'], ['--config-env', 'core.hooksPath=HOOKS', 'push'],
    // the Codex harness prefix is no pass for anything else the policy refuses
    ['-c', 'safe.bareRepository=explicit', '-c', 'core.hooksPath=NUL', '-c', 'core.fsmonitor=false', 'worktree', 'add', '../x'],
    // combined short flags carry every letter
    ['push', '-fu', 'origin', 'main'], ['push', '-vf'], ['push', '-ud', 'origin', 'x'], ['branch', '-dD', 'x'], ['branch', '-fm', 'a', 'b'],
    // a push leaves by the configured remote only; remotes and hooks stay as configured
    ['push', 'https://example.com/x.git', 'main'], ['push', 'git@example.com:x.git', 'HEAD:main'], ['push', '../elsewhere', 'main'],
    ['push', '--repo=https://example.com/x.git'], ['-c', 'remote.origin.pushurl=https://example.com/x.git', 'push', 'origin', 'main'],
    ['-c', 'url.https://example.com/.pushInsteadOf=https://github.com/', 'push'],
    ['remote', 'add', 'exfil', 'https://example.com/x.git'], ['remote', 'set-url', 'origin', 'x'], ['remote', 'rename', 'origin', 'o'], ['remote', 'remove', 'origin'],
    ['config', 'core.hooksPath', '/dev/null'], ['config', 'set', 'core.hooksPath', 'x'],
    ['config', 'remote.origin.url', 'https://example.com/x.git'], ['config', '--add', 'remote.origin.pushurl', 'x'],
    ['config', '--remove-section', 'core'], ['config', '--rename-section', 'remote.origin', 'remote.x'], ['config', '--edit'],
    // path-bearing verbs fail closed without the job's owned paths
    ['commit', '-m', 'feat: x', '--', 'src/mine'], ['add', 'src/mine'], ['rm', 'src/mine/a.ts'],
  ]) {
    const v = refused(argv);
    assert.equal(v.allow, false, `expected refusal: git ${argv.join(' ')}`);
    assert.ok(v.code && v.reason && v.remedy, `typed refusal for git ${argv.join(' ')}`);
  }
  for (const argv of [
    ['status', '--porcelain'], ['log', '--oneline', '-5'], ['diff', '--cached', '--name-only'], ['rev-parse', 'HEAD'],
    ['revert', '--no-edit', 'abc123'],
    ['merge', '--ff-only', 'origin/main'], ['pull', '--ff-only'], ['push', 'origin', 'main'], ['fetch', 'origin'],
    ['stash', 'list'], ['clean', '-n'], ['rebase', '--abort'], ['cherry-pick', 'abc'], ['show', 'HEAD:src/a.ts'],
    ['branch', '--show-current'], ['symbolic-ref', 'HEAD'], ['--no-pager', 'log', '-1'],
    ['push', '-u', 'origin', 'main'], ['push', '-o', 'ci.skip', 'origin', 'HEAD:main'], ['push', '--set-upstream', 'origin', 'HEAD'],
    ['branch', '-vv'], ['branch', '-a', '--contains', 'HEAD'], ['remote', '-v'], ['remote', 'get-url', 'origin'], ['remote'],
    ['config', 'user.name', 'x'], ['config', '--get', 'core.hooksPath'], ['config', 'core.hooksPath'], ['config', '--get-regexp', 'remote\\..*'],
    ['stash', 'create'], ['add'],
    // a command that runs no hook may switch hooks off: the Codex CLI harness's probes (refusals.jsonl, 2026-09-24)
    ['-c', 'safe.bareRepository=explicit', '-c', 'core.hooksPath=NUL', '-c', 'core.fsmonitor=false', 'rev-parse', '--git-dir'],
    ['-c', 'safe.bareRepository=explicit', '-c', 'core.hooksPath=NUL', '-c', 'core.fsmonitor=false', 'rev-parse', 'HEAD'],
    ['-c', 'safe.bareRepository=explicit', '-c', 'core.hooksPath=NUL', '-c', 'core.fsmonitor=false', 'remote', '-v'],
    ['-c', 'safe.bareRepository=explicit', '-c', 'core.hooksPath=NUL', '-c', 'core.fsmonitor=false', 'status', '--porcelain'],
    ['-c', 'core.hooksPath=NUL', 'branch', '--show-current'], ['-c', 'core.hooksPath=NUL', 'stash', 'list'],
    ['-c', 'core.hooksPath=NUL', 'ls-files', '--others', '--exclude-standard'], ['-c', 'core.hooksPath=NUL', 'for-each-ref', '--format=%(refname:short)', 'refs/heads'],
    ['-c', 'core.hooksPath=.nohooks', 'status'],
  ]) assert.equal(refused(argv).allow, true, `expected allow: git ${argv.join(' ')}`);
  // husky's install sets core.hooksPath to the value it already has on every npm install
  const husky = { currentConfig: (key) => (key === 'core.hooksPath' ? '.husky/_' : null) };
  assert.equal(classifyGit(['config', 'core.hooksPath', '.husky/_'], husky).allow, true);
  assert.equal(classifyGit(['config', 'core.hooksPath', '.husky/_/'], husky).allow, true);
  assert.equal(classifyGit(['config', 'core.hooksPath', '.husky/_'], {}).code, 'CONFIG_GUARDED', 'unset before: a new hooks path');
  assert.equal(classifyGit(['config', 'core.hooksPath', '/dev/null'], husky).code, 'CONFIG_GUARDED');
  assert.equal(classifyGit(['config', '--unset', 'core.hooksPath'], husky).code, 'CONFIG_GUARDED');
  assert.equal(classifyGit(['config', 'unset', 'core.hooksPath'], husky).code, 'CONFIG_GUARDED');
  // config git reads from the environment counts like -c
  for (const env of [{ GIT_CONFIG_PARAMETERS: "'core.hooksPath'='NUL'" }, { GIT_CONFIG_PARAMETERS: "'user.name'='x' 'core.hookspath=NUL'" },
    { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: '/dev/null' }])
    assert.equal(classifyGit(['commit', '-m', 'x', '--', 'a'], { env }).code, 'HOOKS_BYPASS', JSON.stringify(env));
  assert.equal(classifyGit(['push', 'origin', 'main'], { env: { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'remote.origin.url', GIT_CONFIG_VALUE_0: 'x' } }).code, 'PUSH_REMOTE_NOT_CONFIGURED');
  assert.equal(classifyGit(['status'], { env: { GIT_CONFIG_PARAMETERS: "'core.hooksPath'='NUL'" } }).allow, true);
  assert.deepEqual(envConfig({ GIT_CONFIG_PARAMETERS: "'a.b'='it'\\''s' 'c.d=e'" }), ["a.b=it's", 'c.d=e']);
  assert.equal(refused(['push', 'https://example.com/x.git', 'main']).code, 'PUSH_REMOTE_NOT_CONFIGURED');
  assert.equal(refused(['remote', 'add', 'x', 'y']).code, 'REMOTE_REWRITE');
  assert.equal(refused(['config', 'remote.origin.url', 'x']).code, 'CONFIG_GUARDED');
  assert.equal(refused(['push', '-fu', 'origin', 'main']).code, 'HISTORY_REWRITE');
  assert.equal(refused(['commit', '-m', 'x', '--', 'src/mine']).code, 'PATH_NOT_OWNED');
  assert.equal(classifyGit(['add', '-A'], { env: { GIT_INDEX_FILE: 'snapshot.index' } }).allow, true, 'a private index is nobody else\'s');
  assert.equal(refused(['reset', '--soft', 'HEAD~1']).code, 'HISTORY_REWRITE');
  assert.equal(refused(['stash']).code, 'SHARED_WORKTREE_DISCARD');
  assert.equal(refused(['commit', '-m', 'x']).code, 'COMMIT_NOT_SCOPED');
});

test('discarding, staging and committing are scoped to the op owned paths', () => {
  const cwd = path.resolve(os.tmpdir(), 'repo');
  const owned = [path.join(cwd, 'src/features/collab/tasks'), path.join(cwd, '.starciwork/features/collab/impl/nivo-backend/tasks')];
  const ctx = { cwd, owned, top: cwd };
  assert.equal(classifyGit(['checkout', '--', 'src/features/collab/tasks/a.ts'], ctx).allow, true);
  assert.equal(classifyGit(['checkout', '--', 'src/features/workspace-provision/x.ts'], ctx).code, 'PATH_NOT_OWNED');
  assert.equal(classifyGit(['checkout', '--', '.'], ctx).code, 'PATH_NOT_OWNED');
  assert.equal(classifyGit(['restore', '--staged', '--', '.starcistacks/dev/stack.yaml.enc'], ctx).code, 'PATH_NOT_OWNED');
  assert.equal(classifyGit(['restore', '--', 'src/features/collab/tasks'], ctx).allow, true);
  assert.equal(classifyGit(['reset', '-q', '--', 'src/features/collab/tasks/a.ts'], ctx).allow, true);
  assert.equal(classifyGit(['reset', 'HEAD', '--', 'src/other'], ctx).code, 'PATH_NOT_OWNED');
  assert.equal(classifyGit(['add', '--', 'src/features/collab/tasks', '.starciwork/features/collab/impl/nivo-backend/tasks/index.yaml'], ctx).allow, true);
  assert.equal(classifyGit(['add', '.'], ctx).code, 'PATH_NOT_OWNED');
  assert.equal(classifyGit(['commit', '-m', 'x', '--', 'src/features/collab/tasks', '.starcistacks/dev/stack.yaml.enc'], ctx).code, 'PATH_NOT_OWNED');
  assert.equal(classifyGit(['commit', '-m', 'x', '--', 'src/features/collab/tasks/*.ts'], ctx).allow, true);
  assert.equal(classifyGit(['clean', '-fd', '--', 'src/features/collab/tasks/tmp'], ctx).allow, true);
  assert.equal(classifyGit(['clean', '-fd', '--', 'src'], ctx).code, 'PATH_NOT_OWNED');
  assert.equal(classifyGit(['-C', 'src/features/collab', 'checkout', '--', 'tasks/a.ts'], ctx).allow, true);
  assert.equal(classifyGit(['commit', '-m', 'feat: x', '--', 'src/features/collab/tasks'], ctx).allow, true);
  assert.equal(classifyGit(['commit', '-m', 'x', 'src/features/collab/tasks/a.ts'], ctx).allow, true);
  // unknown owned paths (no readable guard file): nothing is proven owned, so no path-bearing verb passes
  for (const argv of [['checkout', '--', 'src/a.ts'], ['restore', 'src/a.ts'], ['commit', '-m', 'x', '--', 'src/a.ts'], ['add', 'src/a.ts'], ['rm', 'src/a.ts'], ['mv', 'a', 'b']])
    assert.equal(classifyGit(argv, { cwd }).code, 'PATH_NOT_OWNED', `git ${argv.join(' ')}`);
  assert.deepEqual(pathspecsWithinOwned([':(exclude)src/x', 'src/features/collab/tasks'], ctx), { ok: true, outside: [] });
  assert.equal(pathspecsWithinOwned([':/src'], ctx).ok, false);
});

test('npm install-family commands take the lock; npm ci is the node_modules delete', () => {
  assert.equal(classifyNpm(['ci']).kind, 'clean-install');
  assert.equal(classifyNpm(['install']).kind, 'install');
  assert.equal(classifyNpm(['i', '-D', 'x']).kind, 'install');
  assert.equal(classifyNpm(['--prefix', 'apps/web', 'install']).kind, 'install');
  assert.equal(classifyNpm(['uninstall', 'x']).kind, 'install');
  assert.equal(classifyNpm(['install', '-g', 'x']).kind, 'pass');
  assert.equal(classifyNpm(['run', 'test']).kind, 'pass');
  assert.equal(classifyNpm(['test']).kind, 'pass');
  assert.equal(classifyNpm(['exec', 'jest']).kind, 'pass');
  assert.equal(classifyNpm(['--version']).kind, 'pass');
  // npm's aliases of ci-and-test delete node_modules too
  for (const sub of ['cit', 'install-ci-test', 'clean-install-test', 'sit']) assert.equal(classifyNpm([sub]).kind, 'clean-install', sub);
  for (const sub of ['it', 'install-test']) assert.equal(classifyNpm([sub]).kind, 'install', sub);
});

test('the repository dependency lock serializes installs and takes over a dead holder', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deps-lock-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const lockFile = path.join(dir, 'starci-deps.lock');
  const first = acquireDepsLock({ lockFile, holder: { jobId: 'job-a', command: 'npm install' } });
  assert.equal(first.ok, true);
  let waited = null;
  const second = acquireDepsLock({ lockFile, holder: { jobId: 'job-b' }, waitMs: 50, pollMs: 10, onWait: (h) => { waited = h; } });
  assert.equal(second.ok, false);
  assert.equal(second.holder.jobId, 'job-a');
  assert.equal(waited.jobId, 'job-a');
  first.release();
  const third = acquireDepsLock({ lockFile, holder: { jobId: 'job-c' }, waitMs: 50, pollMs: 10 });
  assert.equal(third.ok, true);
  third.release();
  fs.writeFileSync(lockFile, JSON.stringify({ jobId: 'dead', pid: 2 ** 22 + 7, at: new Date().toISOString() }));
  const takeover = acquireDepsLock({ lockFile, holder: { jobId: 'job-d' }, waitMs: 50, pollMs: 10 });
  assert.equal(takeover.ok, true, 'a lock whose holder process is gone is taken over');
  takeover.release();
  // A live holder's long install keeps its lock (an hour in), and a holder releases only its own lock.
  fs.writeFileSync(lockFile, JSON.stringify({ jobId: 'long-install', pid: process.pid, at: new Date(Date.now() - 3_600_000).toISOString() }));
  assert.equal(acquireDepsLock({ lockFile, holder: { jobId: 'job-e' }, waitMs: 50, pollMs: 10 }).ok, false, 'an hour-long live install is not stolen');
  fs.rmSync(lockFile);
  const owner = acquireDepsLock({ lockFile, holder: { jobId: 'job-f' }, waitMs: 50, pollMs: 10 });
  fs.writeFileSync(lockFile, JSON.stringify({ jobId: 'job-g', pid: process.pid, at: new Date().toISOString() }));
  owner.release();
  assert.equal(JSON.parse(fs.readFileSync(lockFile, 'utf8')).jobId, 'job-g', 'release never deletes another holder\'s lock');
});

test('peer leases are read from the ledger, never this workflow\'s own jobs', async (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'deps-ledger-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, '.starciwork'));
  const db = new DatabaseSync(path.join(repo, '.starciwork', 'runtime.sqlite'));
  db.exec("CREATE TABLE jobs(job_id TEXT, workflow_id TEXT, op_id TEXT, kind TEXT, status TEXT)");
  const add = db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?)');
  add.run('op-a', 'wf-collab', 'backend.implement', 'op', 'running');
  add.run('op-b', 'wf-auth', 'backend.implement', 'op', 'running');
  add.run('op-c', 'wf-auth', 'backend.implement', 'op', 'succeeded');
  add.run('k-1', 'wf-auth', null, 'kernel', 'running');
  db.close();
  const peers = await peerLeasedJobs({ ledgerRepo: repo, workflowId: 'wf-collab' });
  assert.equal(peers.known, true);
  assert.deepEqual(peers.jobs.map((j) => j.jobId), ['op-b']);
  assert.deepEqual((await peerLeasedJobs({ ledgerRepo: repo, workflowId: 'wf-auth' })).jobs.map((j) => j.jobId), ['op-a']);
});

const sh = (cwd, args, env = {}) => spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
const initRepo = (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-repo-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.email', 't@t'], ['config', 'user.name', 't'], ['config', 'commit.gpgsign', 'false']]) sh(repo, args);
  fs.mkdirSync(path.join(repo, 'src', 'mine'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'src', 'peer'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'a.txt'), 'a\n');
  fs.writeFileSync(path.join(repo, 'src', 'peer', 'b.txt'), 'b\n');
  sh(repo, ['add', '.']);
  sh(repo, ['commit', '-q', '-m', 'base']);
  fs.writeFileSync(path.join(repo, 'src', 'peer', 'b.txt'), 'peer commit\n');
  sh(repo, ['commit', '-q', '-am', 'peer: landed']);
  return repo;
};

test('the reference-transaction hook keeps the shared branch append-only for every caller', (t) => {
  const repo = initRepo(t);
  const hook = ensureHistoryHook(repo, { skillRoot: ROOT });
  assert.equal(hook.installed, true, JSON.stringify(hook));
  assert.equal(ensureHistoryHook(repo, { skillRoot: ROOT }).changed, false, 'idempotent');
  const head = sh(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const reset = sh(repo, ['reset', '--soft', 'HEAD~1']);
  assert.notEqual(reset.status, 0, 'reset --soft over a landed commit is refused');
  assert.match(reset.stderr, /starci history guard: refused moving protected branch main/);
  assert.equal(sh(repo, ['rev-parse', 'HEAD']).stdout.trim(), head);
  const amend = sh(repo, ['commit', '--amend', '-q', '-m', 'rewritten']);
  assert.notEqual(amend.status, 0, 'amend is refused');
  assert.equal(sh(repo, ['rev-parse', 'HEAD']).stdout.trim(), head);
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'a.txt'), 'dirty\n');
  // refs/stash stays writable at the git level: lint-staged's pre-commit backup (mia, starci-next) stores
  // one; a sweeping stash is refused by the op shim (git-policy.mjs), not by the hook.
  const backup = sh(repo, ['stash', 'create']).stdout.trim();
  assert.equal(sh(repo, ['stash', 'store', '-q', '-m', 'lint-staged automatic backup', backup]).status, 0);
  assert.equal(sh(repo, ['stash', 'drop', '-q']).status, 0);
  assert.equal(fs.readFileSync(path.join(repo, 'src', 'mine', 'a.txt'), 'utf8'), 'dirty\n', 'the worktree is untouched');
  assert.equal(sh(repo, ['commit', '-q', '-m', 'mine', '--', 'src/mine']).status, 0, 'a forward commit lands');
  assert.equal(sh(repo, ['revert', '--no-edit', 'HEAD']).status, 0, 'revert is the undo');
  assert.equal(sh(repo, ['branch', 'scratch', 'HEAD~1']).status, 0, 'unprotected branches are free');
  assert.equal(sh(repo, ['branch', '-f', 'scratch', 'HEAD~2']).status, 0);
  const flagged = sh(repo, ['reset', '--soft', 'HEAD~1'], { STARCI_HISTORY_GUARD: 'owner-override' });
  assert.notEqual(flagged.status, 0, 'no environment flag overrides the hook');
});

test('an op commit that carries a foreign path is refused by the hook', (t) => {
  const repo = initRepo(t);
  assert.equal(ensureHistoryHook(repo, { skillRoot: ROOT }).installed, true);
  const guardRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-root-'));
  t.after(() => fs.rmSync(guardRoot, { recursive: true, force: true }));
  const file = writeJobGuard({ skillRoot: guardRoot, jobId: 'op-backend.implement-aa64f5170e', workflowId: 'wf-collab', ledgerRepo: null, owned: [path.join(repo, 'src', 'mine')] });
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'a.txt'), 'mine 2\n');
  fs.writeFileSync(path.join(repo, 'src', 'peer', 'b.txt'), 'peer uncommitted\n');
  sh(repo, ['add', 'src/mine/a.txt', 'src/peer/b.txt']);
  const head = sh(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const swept = sh(repo, ['commit', '-q', '-m', 'mine'], { STARCI_GUARD_FILE: file });
  assert.notEqual(swept.status, 0);
  assert.match(swept.stderr, /COMMIT_FOREIGN_PATHS/);
  assert.match(swept.stderr, /src\/peer\/b\.txt/);
  assert.equal(sh(repo, ['rev-parse', 'HEAD']).stdout.trim(), head);
  const scoped = sh(repo, ['commit', '-q', '-m', 'mine', '--', 'src/mine'], { STARCI_GUARD_FILE: file });
  assert.equal(scoped.status, 0, scoped.stderr);
  assert.deepEqual(sh(repo, ['diff-tree', '-r', '--name-only', '--no-commit-id', 'HEAD']).stdout.trim().split('\n'), ['src/mine/a.txt']);
});

// diff-tree of a merge lists nothing without -c, so `git merge <foreign branch>` landed foreign files through the
// hook's commit check; a fast-forward to a local foreign branch was never checked at all (only new^1 == old was).
// Every commit an op's update brings that no remote-tracking ref holds is checked now; published history is not.
test('an op that merges a foreign branch is refused by the hook; integrating the published upstream passes', (t) => {
  const repo = initRepo(t);
  assert.equal(ensureHistoryHook(repo, { skillRoot: ROOT }).installed, true);
  const guardRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-merge-root-'));
  t.after(() => fs.rmSync(guardRoot, { recursive: true, force: true }));
  const op = { STARCI_GUARD_FILE: writeJobGuard({ skillRoot: guardRoot, jobId: 'op-backend.implement-merge', workflowId: 'wf-collab', ledgerRepo: null, owned: [path.join(repo, 'src', 'mine')] }) };
  const branchWith = (name, file, body) => {
    assert.equal(sh(repo, ['checkout', '-q', '-b', name, 'main']).status, 0);
    fs.writeFileSync(path.join(repo, file), body);
    assert.equal(sh(repo, ['commit', '-q', '-am', `${name}: ${file}`]).status, 0);
    assert.equal(sh(repo, ['checkout', '-q', 'main']).status, 0);
  };
  branchWith('foreign', 'src/peer/b.txt', 'smuggled\n');
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'a.txt'), 'mine\n');
  assert.equal(sh(repo, ['commit', '-q', '-m', 'mine', '--', 'src/mine'], op).status, 0);
  const head = sh(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const merged = sh(repo, ['merge', '--no-ff', '--no-edit', 'foreign'], op);
  assert.notEqual(merged.status, 0, 'a merge commit bringing a foreign file is refused');
  assert.match(merged.stderr, /COMMIT_FOREIGN_PATHS[\s\S]*src\/peer\/b\.txt/);
  assert.equal(sh(repo, ['rev-parse', 'HEAD']).stdout.trim(), head);
  sh(repo, ['merge', '--abort']);
  sh(repo, ['reset', '-q', '--hard', 'HEAD']);
  branchWith('foreign2', 'src/peer/b.txt', 'two\n');
  sh(repo, ['checkout', '-q', 'foreign2']);
  fs.writeFileSync(path.join(repo, 'src', 'peer', 'b.txt'), 'three\n');
  sh(repo, ['commit', '-q', '-am', 'foreign2: again']);
  sh(repo, ['checkout', '-q', 'main']);
  sh(repo, ['reset', '-q', '--hard', head]);
  const ff = sh(repo, ['merge', '--ff-only', 'foreign2'], op);
  assert.notEqual(ff.status, 0, 'a fast-forward to two local foreign commits is refused too');
  assert.match(ff.stderr, /COMMIT_FOREIGN_PATHS/);
  // The same history once published (on a remote-tracking ref) is integration, not the op's commit.
  assert.equal(sh(repo, ['update-ref', 'refs/remotes/origin/main', 'foreign2']).status, 0);
  const pulled = sh(repo, ['merge', '--no-edit', 'origin/main'], op);
  assert.equal(pulled.status, 0, pulled.stderr);
});

test('a hook of another tool is never overwritten', (t) => {
  const repo = initRepo(t);
  const hooks = path.resolve(repo, sh(repo, ['rev-parse', '--git-path', 'hooks']).stdout.trim());
  fs.mkdirSync(hooks, { recursive: true });
  fs.writeFileSync(path.join(hooks, 'reference-transaction'), '#!/bin/sh\nexit 0\n');
  assert.deepEqual(ensureHistoryHook(repo, { skillRoot: ROOT }).reason, 'foreign-hook');
  assert.match(historyHookBody({ branches: ['develop', 'bad branch'], shim: '/x/shim.mjs', nodePath: '/n/node' }), /PROTECTED=" main master develop "/);
});

test('the git shim in front of the worker refuses and passes through with exact arguments', { skip: false }, (t) => {
  const repo = initRepo(t);
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-bin-'));
  t.after(() => fs.rmSync(bin, { recursive: true, force: true }));
  const built = ensureGuardBin({ skillRoot: ROOT, binDir: bin });
  assert.equal(built.ok, true, JSON.stringify(built));
  const file = writeJobGuard({ skillRoot: bin, jobId: 'op-x', workflowId: 'wf-x', ledgerRepo: null, owned: [path.join(repo, 'src', 'mine')] });
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, STARCI_GUARD_FILE: file, STARCI_GUARD_BIN: bin };
  const gitShim = path.join(bin, process.platform === 'win32' ? 'git.exe' : 'git');
  const run = (args) => spawnSync(gitShim, args, { cwd: repo, encoding: 'utf8', env });
  const reset = run(['reset', '--soft', 'HEAD~1']);
  assert.equal(reset.status, 3);
  assert.match(reset.stderr, /starci guard: refused `git reset --soft HEAD~1` \[HISTORY_REWRITE\]/);
  const discard = run(['checkout', '--', 'src/peer/b.txt']);
  assert.equal(discard.status, 3);
  assert.match(discard.stderr, /PATH_NOT_OWNED/);
  fs.writeFileSync(path.join(repo, 'src', 'peer', 'b.txt'), 'a peer\'s uncommitted work\n');
  const sweep = run(['stash', 'push']);
  assert.equal(sweep.status, 3);
  assert.match(sweep.stderr, /SHARED_WORKTREE_DISCARD/);
  assert.equal(fs.readFileSync(path.join(repo, 'src', 'peer', 'b.txt'), 'utf8'), 'a peer\'s uncommitted work\n', 'the peer\'s change stays');
  assert.equal(run(['stash', 'create']).status, 0, 'a lint-staged backup copy passes');
  assert.equal(run(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim(), 'main', 'stdout passes through');
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'a.txt'), 'shimmed\n');
  const commit = run(['commit', '-q', '-m', 'subject line\n\nbody line with -- and "quotes"', '--', 'src/mine']);
  assert.equal(commit.status, 0, commit.stderr);
  assert.equal(sh(repo, ['log', '-1', '--format=%B']).stdout.trim(), 'subject line\n\nbody line with -- and "quotes"');
  const input = spawnSync(gitShim, ['hash-object', '--stdin'], { cwd: repo, encoding: 'utf8', env, input: 'x\n' });
  const expected = spawnSync('git', ['hash-object', '--stdin'], { cwd: repo, encoding: 'utf8', input: 'x\n' }).stdout.trim();
  assert.equal(input.stdout.trim(), expected, 'stdin passes through');
  assert.equal(run(['status', '--no-such-flag']).status, 129, 'the real exit code comes back');
});

test('guardLaunch puts the shim first and names the job guard file; a layer can be switched off', (t) => {
  const repo = initRepo(t);
  const off = guardLaunch({ skillRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'guard-off-')), jobId: 'op-y', workflowId: 'wf-y', ledgerRepo: repo, owned: [path.join(repo, 'src/mine')], repos: [repo], config: { guards: { shims: false, historyHook: false } } });
  assert.equal(off.pathPrefix, null);
  assert.deepEqual(off.receipt.shims, { disabled: true });
  assert.ok(fs.existsSync(off.env.STARCI_GUARD_FILE));
  const guard = JSON.parse(fs.readFileSync(off.env.STARCI_GUARD_FILE, 'utf8'));
  assert.equal(guard.schema, 'starci/op-guard@1');
  assert.deepEqual(guard.owned, [path.resolve(repo, 'src/mine').replace(/\\/g, '/')]);
});

test('the op launch command puts the guard directory first on the worker PATH', async () => {
  const { pathPrefixCommand, buildSpawnCommand } = await import('../scripts/agent/lib.mjs');
  assert.equal(pathPrefixCommand('C:/x/runtime/guards/bin', 'win32'), "$env:PATH='C:/x/runtime/guards/bin;'+$env:PATH;");
  assert.equal(pathPrefixCommand('/x/runtime/guards/bin', 'posix'), "export PATH='/x/runtime/guards/bin':\"$PATH\";");
  assert.equal(pathPrefixCommand("bad'dir", 'posix'), null);
  const built = buildSpawnCommand({ provider: 'codex', model: 'gpt-x', env: { STARCI_ROLE: 'op', STARCI_OP_JOB: 'op-x' }, pathPrefix: path.join(ROOT, 'runtime', 'guards', 'bin') });
  assert.ok(!built.error, built.error);
  assert.ok(built.command.includes(path.join(ROOT, 'runtime', 'guards', 'bin')), built.command);
  assert.ok(built.command.indexOf('STARCI_OP_JOB') < built.command.indexOf('codex'), 'the environment is set before the agent starts');
});

// nivo inc-d1833bc89c1f: the commit-only (Work debt) packet commits a long owned list with
// --pathspec-from-file, which the guard refused (COMMIT_NOT_SCOPED), so the batched repair could never
// commit. The list's entries are pathspecs: every one inside owned_paths passes, one outside refuses.
test('a --pathspec-from-file list is scoped line by line like named pathspecs', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pathspec-list-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const owned = [path.join(cwd, 'src/features/collab/chat/a.ts'), path.join(cwd, '.starciwork/features/collab/ui/chat'), path.join(cwd, 'src/app/[id]/page.tsx')];
  const ctx = { cwd, owned, top: cwd };
  const list = (name, text) => { fs.writeFileSync(path.join(cwd, name), text); return name; };
  const mine = list('mine.txt', 'src/features/collab/chat/a.ts\r\n.starciwork/features/collab/ui/chat/index.yaml\n".starciwork/features/collab/ui/chat/\\303\\251 x.yaml"\n:(literal)src/app/[id]/page.tsx\n');
  const foreign = list('foreign.txt', 'src/features/collab/chat/a.ts\nsrc/features/workspace-provision/x.ts\n');
  const nul = list('nul.txt', 'src/features/collab/chat/a.ts\0.starciwork/features/collab/ui/chat/a b.yaml\0');
  const empty = list('empty.txt', '');
  assert.deepEqual(parsePathspecList(fs.readFileSync(path.join(cwd, mine), 'utf8')).slice(0, 3),
    ['src/features/collab/chat/a.ts', '.starciwork/features/collab/ui/chat/index.yaml', '.starciwork/features/collab/ui/chat/é x.yaml']);
  // allowed: every line owned, whichever form names the list
  for (const argv of [
    ['add', `--pathspec-from-file=${mine}`], ['add', '--pathspec-from-file', mine],
    ['commit', '-m', 'x', `--pathspec-from-file=${mine}`], ['commit', '-q', '--pathspec-from-file', mine, '-m', 'x'],
    ['commit', '-m', 'x', '--pathspec-file-nul', `--pathspec-from-file=${nul}`],
    ['reset', '-q', `--pathspec-from-file=${mine}`], ['restore', '--staged', `--pathspec-from-file=${mine}`],
    ['checkout', `--pathspec-from-file=${mine}`], ['rm', '--cached', `--pathspec-from-file=${mine}`],
    ['-C', 'src', 'commit', '-m', 'x', `--pathspec-from-file=../${list('sub.txt', 'features/collab/chat/a.ts\n')}`], // lines resolve from the command's directory
  ]) assert.equal(classifyGit(argv, ctx).allow, true, `expected allow: git ${argv.join(' ')} ${JSON.stringify(classifyGit(argv, ctx))}`);
  const stdinText = 'src/features/collab/chat/a.ts\n';
  assert.equal(classifyGit(['commit', '-m', 'x', '--pathspec-from-file=-'], { ...ctx, stdin: stdinText }).allow, true, 'stdin list');
  assert.equal(classifyGit(['add', '--pathspec-from-file', '-'], { ...ctx, stdin: stdinText }).allow, true, 'stdin list, separate word');
  // refused: a line outside owned_paths, an empty or unreadable list
  for (const argv of [['add', `--pathspec-from-file=${foreign}`], ['add', '--pathspec-from-file', foreign],
    ['commit', '-m', 'x', `--pathspec-from-file=${foreign}`], ['reset', `--pathspec-from-file=${foreign}`],
    ['checkout', `--pathspec-from-file=${foreign}`], ['restore', `--pathspec-from-file=${foreign}`], ['rm', `--pathspec-from-file=${foreign}`]]) {
    const v = classifyGit(argv, ctx);
    assert.equal(v.code, 'PATH_NOT_OWNED', `expected PATH_NOT_OWNED: git ${argv.join(' ')}`);
    assert.match(v.reason, /src\/features\/workspace-provision\/x\.ts/);
    assert.doesNotMatch(v.reason, /collab\/chat\/a\.ts/, 'only the foreign line is named');
  }
  assert.equal(classifyGit(['commit', '-m', 'x', `--pathspec-from-file=${mine}`, '--', 'src/other'], ctx).code, 'PATH_NOT_OWNED', 'named pathspecs still count');
  assert.equal(classifyGit(['commit', '-m', 'x', '--pathspec-from-file=-'], { ...ctx, stdin: 'src/features/workspace-provision/x.ts\n' }).code, 'PATH_NOT_OWNED');
  assert.equal(classifyGit(['add', '--pathspec-from-file=-'], { ...ctx, stdin: 'src/features/collab/chat/a.ts\n\nsrc/x\n' }).code, 'PATH_NOT_OWNED');
  assert.equal(classifyGit(['commit', '-m', 'x', `--pathspec-from-file=${empty}`], ctx).code, 'COMMIT_NOT_SCOPED', 'an empty list commits the whole index');
  assert.equal(classifyGit(['commit', '-m', 'x', '--pathspec-from-file=missing.txt'], ctx).code, 'PATHSPEC_FILE_UNREADABLE');
  assert.equal(classifyGit(['commit', '-m', 'x', '--pathspec-from-file=-'], ctx).code, 'PATHSPEC_FILE_UNREADABLE', 'stdin the shim did not read');
  assert.equal(classifyGit(['commit', '-a', '-m', 'x', `--pathspec-from-file=${mine}`], ctx).code, 'COMMIT_NOT_SCOPED', '-a still refuses');
  assert.equal(classifyGit(['reset', '--soft', `--pathspec-from-file=${mine}`], ctx).code, 'HISTORY_REWRITE');
  assert.equal(classifyGit(['add', 'src/app/[id]/page.tsx'], ctx).allow, true, 'an App Router segment is a literal name (inc-21f76abb6d10)');
  assert.equal(classifyGit(['add', 'src/app/[id]/pa?e.tsx'], ctx).code, 'PATH_NOT_OWNED', 'a real glob pathspec still reads as a glob');
  assert.equal(classifyGit(['add', '--', ':(literal)src/app/[id]/page.tsx'], ctx).allow, true, ':(literal) names exactly that path');
});

test('the commit-only packet\'s pathspec-list commands are the ones the guard passes', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pathspec-packet-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const owned = [path.join(cwd, 'src/features/collab/chat')];
  fs.writeFileSync(path.join(cwd, 'list.txt'), 'src/features/collab/chat/a.ts\nsrc/features/collab/chat/b.ts\n');
  fs.writeFileSync(path.join(cwd, 'foreign.txt'), 'src/features/collab/chat/a.ts\nsrc/features/login/x.ts\n');
  const argvOf = (cmd, list) => cmd.replace(/^git /, '').replace('<list>', list).match(/"[^"]*"|\S+/g).map((w) => w.replace(/^"|"$/g, ''));
  assert.equal(PATHSPEC_LIST_COMMIT.length, 2);
  for (const cmd of PATHSPEC_LIST_COMMIT) {
    assert.match(cmd, /--pathspec-from-file=<list>/);
    assert.equal(classifyGit(argvOf(cmd, 'list.txt'), { cwd, owned, top: cwd }).allow, true, `the packet's \`${cmd}\` passes the guard`);
    assert.equal(classifyGit(argvOf(cmd, 'foreign.txt'), { cwd, owned, top: cwd }).code, 'PATH_NOT_OWNED', `\`${cmd}\` with a foreign line refuses`);
  }
  const api = fs.readFileSync(path.join(ROOT, 'scripts', 'kernel', 'api.mjs'), 'utf8');
  assert.match(api, /commit_only: this attempt authors nothing[^\n]*\$\{PATHSPEC_LIST_COMMIT\.join\('; '\)\}/, 'the packet renders the commands the guard is tested against');
});

test('the git shim commits a pathspec list (file or stdin) of owned paths and refuses a foreign one', (t) => {
  const repo = initRepo(t);
  assert.equal(ensureHistoryHook(repo, { skillRoot: ROOT }).installed, true);
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-bin-'));
  t.after(() => fs.rmSync(bin, { recursive: true, force: true }));
  assert.equal(ensureGuardBin({ skillRoot: ROOT, binDir: bin }).ok, true);
  const file = writeJobGuard({ skillRoot: bin, jobId: 'op-interface.draw-x', workflowId: 'wf-x', ledgerRepo: null, owned: [path.join(repo, 'src', 'mine')] });
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, STARCI_GUARD_FILE: file, STARCI_GUARD_BIN: bin };
  const gitShim = path.join(bin, process.platform === 'win32' ? 'git.exe' : 'git');
  const run = (args, input) => spawnSync(gitShim, args, { cwd: repo, encoding: 'utf8', env, ...(input == null ? {} : { input }) });
  const lists = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-lists-'));
  t.after(() => fs.rmSync(lists, { recursive: true, force: true }));
  const mine = path.join(lists, 'mine.txt'), foreign = path.join(lists, 'foreign.txt');
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'a.txt'), 'debt a\n');
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'c.txt'), 'debt c\n');
  fs.writeFileSync(path.join(repo, 'src', 'peer', 'b.txt'), 'peer uncommitted\n');
  fs.writeFileSync(mine, 'src/mine/a.txt\nsrc/mine/c.txt\n');
  fs.writeFileSync(foreign, 'src/mine/a.txt\nsrc/peer/b.txt\n');
  const head = sh(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const addForeign = run(['add', `--pathspec-from-file=${foreign}`]);
  assert.equal(addForeign.status, 3);
  assert.match(addForeign.stderr, /PATH_NOT_OWNED[\s\S]*src\/peer\/b\.txt/);
  assert.equal(sh(repo, ['diff', '--cached', '--name-only']).stdout.trim(), '', 'nothing staged');
  const commitForeign = run(['commit', '-q', '-m', 'x', '--pathspec-from-file=-'], 'src/peer/b.txt\n');
  assert.equal(commitForeign.status, 3);
  assert.equal(sh(repo, ['rev-parse', 'HEAD']).stdout.trim(), head);
  const add = run(['add', `--pathspec-from-file=${mine}`]);
  assert.equal(add.status, 0, add.stderr);
  const commit = run(['commit', '-q', '-m', 'commit-only: work debt', `--pathspec-from-file=${mine}`]);
  assert.equal(commit.status, 0, commit.stderr);
  assert.deepEqual(sh(repo, ['diff-tree', '-r', '--name-only', '--no-commit-id', 'HEAD']).stdout.trim().split('\n'), ['src/mine/a.txt', 'src/mine/c.txt']);
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'a.txt'), 'debt a 2\n');
  const viaStdin = run(['commit', '-q', '-m', 'commit-only: stdin list', '--pathspec-from-file=-'], 'src/mine/a.txt\n');
  assert.equal(viaStdin.status, 0, viaStdin.stderr);
  assert.deepEqual(sh(repo, ['diff-tree', '-r', '--name-only', '--no-commit-id', 'HEAD']).stdout.trim().split('\n'), ['src/mine/a.txt'], 'git read the list the shim handed on');
  assert.equal(sh(repo, ['status', '--porcelain', '--', 'src/peer']).stdout.trim(), 'M src/peer/b.txt', 'the peer\'s change stays uncommitted');
});
