import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { classifyGit, envConfig, pathspecsWithinOwned, parsePathspecList } from '../../scripts/guards/git-policy.mjs';
import { classifyInstall, peerLeasedJobs } from '../../scripts/guards/deps-guard.mjs';
import { ensureHistoryHook, writeJobGuard, historyHookBody, guardLaunch, bindGuardTerminal } from '../../scripts/guards/hook-install.mjs';
import { commandVerdict } from '../../scripts/guards/command-guard.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

// nivo, 2026-09-23/24: four workflows share nivo-backend main. A Collab worker ran
// `git reset --soft HEAD~1` over the workspace-provision commit 1ed65948 (inc-40fed684fff8,
// inc-cb721b99fdd1), a commit swept a hook-restaged foreign file (inc-5d7ce049e810), and
// node_modules was deleted and recreated under running checks (inc-7faca0d4d632,
// inc-3de1d5efdea6). scripts/guards/ refuses those before the worker's command runs (command-guard.mjs, a
// PreToolUse hook) and in git itself (reference-transaction hook).

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const refused = (argv, ctx) => classifyGit(argv, ctx);
// An op, to the history hook: its guard bound to the Orca terminal its agent runs in.
const boundOp = (t, file, tag) => {
  const handle = `term_spec-shared-${tag}-${process.pid}`;
  const bound = bindGuardTerminal({ skillRoot: ROOT, handle, jobFile: file });
  t.after(() => fs.rmSync(bound, { force: true }));
  return { ORCA_TERMINAL_HANDLE: handle };
};
// An agent's shell call: the command guard decides first, and only an allowed command reaches git.
const guarded = (repo, file) => async (args, input) => {
  const quote = (a) => `'${String(a).replace(/'/g, `'\\''`)}'`;
  const verdict = await commandVerdict({ command: `git ${args.map(quote).join(' ')}`, cwd: repo, guard: JSON.parse(fs.readFileSync(file, 'utf8')), env: process.env });
  if (verdict) return { status: 2, stderr: `starci guard: refused \`git ${verdict.command}\` [${verdict.code}] ${verdict.reason}`, verdict };
  return spawnSync('git', args, { cwd: repo, encoding: 'utf8', ...(input == null ? {} : { input }) });
};

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

test('npm install-family commands are installs; npm ci is the node_modules delete', () => {
  assert.equal(classifyInstall('npm', ['ci']).kind, 'clean-install');
  assert.equal(classifyInstall('npm', ['install']).kind, 'install');
  assert.equal(classifyInstall('npm', ['i', '-D', 'x']).kind, 'install');
  assert.equal(classifyInstall('npm', ['--prefix', 'apps/web', 'install']).kind, 'install');
  assert.equal(classifyInstall('npm', ['uninstall', 'x']).kind, 'install');
  assert.equal(classifyInstall('npm', ['install', '-g', 'x']).kind, 'pass');
  assert.equal(classifyInstall('npm', ['run', 'test']).kind, 'pass');
  assert.equal(classifyInstall('npm', ['test']).kind, 'pass');
  assert.equal(classifyInstall('npm', ['exec', 'jest']).kind, 'pass');
  assert.equal(classifyInstall('npm', ['--version']).kind, 'pass');
  // npm's aliases of ci-and-test delete node_modules too
  for (const sub of ['cit', 'install-ci-test', 'clean-install-test', 'sit']) assert.equal(classifyInstall('npm', [sub]).kind, 'clean-install', sub);
  for (const sub of ['it', 'install-test']) assert.equal(classifyInstall('npm', [sub]).kind, 'install', sub);
});

test('peer leases are read from the ledger, never this workflow\'s own jobs', async (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'deps-ledger-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, '.starciwork'));
  const { openLedger } = await import('../../engine/db/ledger.mjs');
  const { seedWorkflow } = await import('../helpers/ledger-fixture.mjs');
  const ledger = openLedger({ file: path.join(repo, '.starciwork', 'runtime.sqlite') });
  try {
    seedWorkflow(ledger, { id: 'wf-collab', jobs: [{ jobId: 'op-a', opId: 'backend.implement', status: 'running' }] });
    seedWorkflow(ledger, { id: 'wf-auth', jobs: [
      { jobId: 'op-b', opId: 'backend.implement', status: 'running' },
      { jobId: 'op-c', opId: 'backend.implement', status: 'succeeded' },
      { jobId: 'k-1', kind: 'kernel', status: 'running' }] });
  } finally { ledger.close(); }
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
  const op = boundOp(t, file, 'foreign');
  const swept = sh(repo, ['commit', '-q', '-m', 'mine'], op);
  assert.notEqual(swept.status, 0);
  assert.match(swept.stderr, /COMMIT_FOREIGN_PATHS/);
  assert.match(swept.stderr, /src\/peer\/b\.txt/);
  assert.equal(sh(repo, ['rev-parse', 'HEAD']).stdout.trim(), head);
  const scoped = sh(repo, ['commit', '-q', '-m', 'mine', '--', 'src/mine'], op);
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
  const op = boundOp(t, writeJobGuard({ skillRoot: guardRoot, jobId: 'op-backend.implement-merge', workflowId: 'wf-collab', ledgerRepo: null, owned: [path.join(repo, 'src', 'mine')] }), 'merge');
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
  assert.match(historyHookBody({ branches: ['develop', 'bad branch'], verify: '/x/verify-commit.mjs', nodePath: '/n/node' }), /PROTECTED=" main master develop "/);
});

test('the command guard refuses before git runs and passes the command as written', async (t) => {
  const repo = initRepo(t);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-root-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = writeJobGuard({ skillRoot: root, jobId: 'op-x', workflowId: 'wf-x', ledgerRepo: null, owned: [path.join(repo, 'src', 'mine')] });
  const run = guarded(repo, file);
  const reset = await run(['reset', '--soft', 'HEAD~1']);
  assert.equal(reset.status, 2);
  assert.match(reset.stderr, /starci guard: refused `git reset --soft HEAD~1` \[HISTORY_REWRITE\]/);
  const discard = await run(['checkout', '--', 'src/peer/b.txt']);
  assert.equal(discard.status, 2);
  assert.match(discard.stderr, /PATH_NOT_OWNED/);
  fs.writeFileSync(path.join(repo, 'src', 'peer', 'b.txt'), 'a peer\'s uncommitted work\n');
  const sweep = await run(['stash', 'push']);
  assert.equal(sweep.status, 2);
  assert.match(sweep.stderr, /SHARED_WORKTREE_DISCARD/);
  assert.equal(fs.readFileSync(path.join(repo, 'src', 'peer', 'b.txt'), 'utf8'), 'a peer\'s uncommitted work\n', 'the peer\'s change stays');
  assert.equal((await run(['stash', 'create'])).status, 0, 'a lint-staged backup copy passes');
  assert.equal((await run(['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim(), 'main');
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'a.txt'), 'guarded\n');
  const commit = await run(['commit', '-q', '-m', 'subject line\n\nbody line with -- and "quotes"', '--', 'src/mine']);
  assert.equal(commit.status, 0, commit.stderr);
  assert.equal(sh(repo, ['log', '-1', '--format=%B']).stdout.trim(), 'subject line\n\nbody line with -- and "quotes"');
});

test('guardLaunch writes the job guard file the launch binds to the worker terminal; a hook layer can be switched off', (t) => {
  const repo = initRepo(t);
  const off = guardLaunch({ skillRoot: mkdtemp(t, 'guard-off-'), jobId: 'op-y', workflowId: 'wf-y', ledgerRepo: repo, owned: [path.join(repo, 'src/mine')], repos: [repo], config: { guards: { historyHook: false, workHook: false } } });
  assert.deepEqual(Object.keys(off), ['receipt'], 'nothing reaches the agent\'s environment');
  assert.deepEqual(off.receipt.hooks, [{ disabled: true }]);
  assert.deepEqual(off.receipt.workHooks, [{ disabled: true }]);
  assert.ok(fs.existsSync(off.receipt.jobFile));
  const guard = JSON.parse(fs.readFileSync(off.receipt.jobFile, 'utf8'));
  assert.equal(guard.schema, 'starci/op-guard@1');
  assert.deepEqual(guard.owned, [path.resolve(repo, 'src/mine').replace(/\\/g, '/')]);
});


// nivo inc-d1833bc89c1f: a long owned list is committed with
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
  assert.equal(classifyGit(['commit', '-m', 'x', '--pathspec-from-file=-'], ctx).code, 'PATHSPEC_FILE_UNREADABLE', 'stdin the guard cannot read before the command runs');
  assert.equal(classifyGit(['commit', '-a', '-m', 'x', `--pathspec-from-file=${mine}`], ctx).code, 'COMMIT_NOT_SCOPED', '-a still refuses');
  assert.equal(classifyGit(['reset', '--soft', `--pathspec-from-file=${mine}`], ctx).code, 'HISTORY_REWRITE');
  assert.equal(classifyGit(['add', 'src/app/[id]/page.tsx'], ctx).allow, true, 'an App Router segment is a literal name (inc-21f76abb6d10)');
  assert.equal(classifyGit(['add', 'src/app/[id]/pa?e.tsx'], ctx).code, 'PATH_NOT_OWNED', 'a real glob pathspec still reads as a glob');
  assert.equal(classifyGit(['add', '--', ':(literal)src/app/[id]/page.tsx'], ctx).allow, true, ':(literal) names exactly that path');
});

test('through the command guard, a pathspec list file of owned paths commits and a foreign or stdin one is refused', async (t) => {
  const repo = initRepo(t);
  assert.equal(ensureHistoryHook(repo, { skillRoot: ROOT }).installed, true);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-root-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = writeJobGuard({ skillRoot: root, jobId: 'op-interface.draw-x', workflowId: 'wf-x', ledgerRepo: null, owned: [path.join(repo, 'src', 'mine')] });
  const run = guarded(repo, file);
  const lists = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-lists-'));
  t.after(() => fs.rmSync(lists, { recursive: true, force: true }));
  const mine = path.join(lists, 'mine.txt'), foreign = path.join(lists, 'foreign.txt');
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'a.txt'), 'debt a\n');
  fs.writeFileSync(path.join(repo, 'src', 'mine', 'c.txt'), 'debt c\n');
  fs.writeFileSync(path.join(repo, 'src', 'peer', 'b.txt'), 'peer uncommitted\n');
  fs.writeFileSync(mine, 'src/mine/a.txt\nsrc/mine/c.txt\n');
  fs.writeFileSync(foreign, 'src/mine/a.txt\nsrc/peer/b.txt\n');
  const head = sh(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const addForeign = await run(['add', `--pathspec-from-file=${foreign}`]);
  assert.equal(addForeign.status, 2);
  assert.match(addForeign.stderr, /PATH_NOT_OWNED[\s\S]*src\/peer\/b\.txt/);
  assert.equal(sh(repo, ['diff', '--cached', '--name-only']).stdout.trim(), '', 'nothing staged');
  // A stdin list is not readable before the command runs: refused with the list-file remedy, owned or not.
  for (const list of ['src/peer/b.txt\n', 'src/mine/a.txt\n']) {
    const viaStdin = await run(['commit', '-q', '-m', 'x', '--pathspec-from-file=-'], list);
    assert.equal(viaStdin.verdict?.code, 'PATHSPEC_FILE_UNREADABLE');
    assert.match(viaStdin.verdict.remedy, /--pathspec-from-file=<file>/);
  }
  assert.equal(sh(repo, ['rev-parse', 'HEAD']).stdout.trim(), head);
  const add = await run(['add', `--pathspec-from-file=${mine}`]);
  assert.equal(add.status, 0, add.stderr);
  const commit = await run(['commit', '-q', '-m', 'a long owned list', `--pathspec-from-file=${mine}`]);
  assert.equal(commit.status, 0, commit.stderr);
  assert.deepEqual(sh(repo, ['diff-tree', '-r', '--name-only', '--no-commit-id', 'HEAD']).stdout.trim().split('\n'), ['src/mine/a.txt', 'src/mine/c.txt']);
  assert.equal(sh(repo, ['status', '--porcelain', '--', 'src/peer']).stdout.trim(), 'M src/peer/b.txt', 'the peer\'s change stays uncommitted');
});
