import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import {
  bindGuardTerminal,
  ensureHistoryHook,
  ensureWorkHook,
  writeJobGuard,
} from '../../scripts/guards/hook-install.mjs';
import { GUARDS_ROOT_ENV } from '../../scripts/guards/guards-root.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const GIT_ENV_KEYS = [
  'GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY',
  'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_GLOBAL', 'GIT_PREFIX',
];

const gitEnv = (home, extra = {}) => {
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    GIT_CONFIG_NOSYSTEM: '1',
    ...extra,
  };
  for (const key of GIT_ENV_KEYS) delete env[key];
  return env;
};

const git = (repo, env, ...args) => spawnSync('git', ['-C', repo, ...args], {
  encoding: 'utf8',
  env,
  timeout: 25_000,
  windowsHide: true,
});

const gitOk = (repo, env, ...args) => {
  const result = git(repo, env, ...args);
  assert.equal(result.status, 0, `git ${args.join(' ')}\n${result.stderr}`);
  return result.stdout.trim();
};

const put = (repo, relative, text) => {
  const file = path.join(repo, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

test('installed hooks enforce staged Work hygiene and protected history in real git processes', { timeout: 30_000 }, (t) => {
  const available = spawnSync('git', ['--version'], { encoding: 'utf8', windowsHide: true });
  if (available.error?.code === 'ENOENT') return t.skip('git is not installed');
  assert.equal(available.status, 0, available.stderr);

  const fixture = mkdtemp(t, 'starci-git-hooks-e2e-');
  const repo = path.join(fixture, 'repo with spaces');
  const home = path.join(fixture, 'home with spaces');
  const guards = path.join(fixture, 'guards');
  for (const directory of [repo, home, guards]) fs.mkdirSync(directory, { recursive: true });
  const env = gitEnv(home);

  const priorGuardsRoot = process.env[GUARDS_ROOT_ENV];
  process.env[GUARDS_ROOT_ENV] = guards;
  t.after(() => {
    if (priorGuardsRoot === undefined) delete process.env[GUARDS_ROOT_ENV];
    else process.env[GUARDS_ROOT_ENV] = priorGuardsRoot;
  });

  gitOk(repo, env, 'init', '--quiet', '-b', 'main');
  for (const [name, value] of [
    ['user.name', 'StarCi hook e2e'],
    ['user.email', 'hook-e2e@starci.test'],
    ['commit.gpgsign', 'false'],
    ['core.autocrlf', 'false'],
  ]) gitOk(repo, env, 'config', '--local', name, value);
  put(repo, 'README.md', '# hook fixture\n');
  gitOk(repo, env, 'add', 'README.md');
  gitOk(repo, env, 'commit', '--quiet', '-m', 'initial');

  const workHook = ensureWorkHook(repo, { skillRoot: ROOT });
  const historyHook = ensureHistoryHook(repo, { skillRoot: ROOT });
  assert.equal(workHook.installed, true, JSON.stringify(workHook));
  assert.equal(historyHook.installed, true, JSON.stringify(historyHook));

  put(repo, '.starciwork/x/index.yaml', 'schema: [broken\n');
  gitOk(repo, env, 'add', '.starciwork/x/index.yaml');
  const broken = git(repo, env, 'commit', '-m', 'broken Work record');
  const brokenOutput = `${broken.stdout}\n${broken.stderr}`;
  if (/cannot (?:run|spawn).*pre-commit|pre-commit.*No such file or directory/i.test(brokenOutput)) {
    return t.skip('the shell required to execute git hooks is not installed');
  }
  assert.notEqual(broken.status, 0, 'the pre-commit hook must refuse invalid staged YAML');
  assert.match(brokenOutput, /WORK_YAML_UNPARSEABLE[\s\S]*\.starciwork\/x\/index\.yaml/);
  gitOk(repo, env, 'reset', '--quiet');
  fs.rmSync(path.join(repo, '.starciwork', 'x', 'index.yaml'));

  const validWorkFile = '.starciwork/features/login/uat/sign-in/accounts.yaml';
  put(repo, validWorkFile, 'schema: work/disposable-accounts@1\ndisposable: true\naccounts:\n  - {role: person, identity: identity.hook-fixture.demo}\n');
  gitOk(repo, env, 'add', validWorkFile);
  gitOk(repo, env, 'commit', '--quiet', '-m', 'valid Work record');
  const main = gitOk(repo, env, 'rev-parse', 'refs/heads/main');
  const parent = gitOk(repo, env, 'rev-parse', `${main}^`);

  gitOk(repo, env, 'switch', '--quiet', '-c', 'feature/e2e');
  put(repo, 'outside-owned.txt', 'feature history\n');
  gitOk(repo, env, 'add', 'outside-owned.txt');
  gitOk(repo, env, 'commit', '--quiet', '-m', 'feature commit');
  const feature = gitOk(repo, env, 'rev-parse', 'HEAD');

  const rewritten = git(repo, env, 'update-ref', 'refs/heads/main', parent, main);
  assert.notEqual(rewritten.status, 0, 'a non-fast-forward main update must be refused');
  assert.match(`${rewritten.stdout}\n${rewritten.stderr}`, /starci history guard: refused moving protected branch main/);
  assert.equal(gitOk(repo, env, 'rev-parse', 'refs/heads/main'), main);

  const handle = `term-hook-e2e-${process.pid}`;
  const jobFile = writeJobGuard({
    skillRoot: ROOT,
    jobId: 'op-hook-e2e',
    workflowId: 'wf-hook-e2e',
    ledgerRepo: null,
    owned: [path.join(repo, 'owned')],
  });
  bindGuardTerminal({ skillRoot: ROOT, handle, jobFile });
  const guardedEnv = gitEnv(home, { ORCA_TERMINAL_HANDLE: handle });
  const guarded = git(repo, guardedEnv, 'update-ref', 'refs/heads/main', feature, main);
  assert.notEqual(guarded.status, 0, 'verify-commit must refuse a fast-forward carrying a foreign path');
  assert.match(`${guarded.stdout}\n${guarded.stderr}`, /COMMIT_FOREIGN_PATHS/);
  assert.match(`${guarded.stdout}\n${guarded.stderr}`, /outside your owned_paths:[^\n]*outside-owned\.txt/);
  assert.equal(gitOk(repo, env, 'rev-parse', 'refs/heads/main'), main);
});
