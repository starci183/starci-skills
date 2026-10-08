import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { installGitHooks, renderRuntimeHooks } from '../../scripts/guards/git-hooks.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const GIT_ENV_KEYS = ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_PREFIX'];
const PROPERTIES = 'sonar.sources=src\nsonar.inclusions=**/*.mjs\nsonar.exclusions=**/*.spec.mjs\n';
const SORTS = 'export const f = (list) => [...list].sort();\n';
const CLEAN = 'export const f = (list) => [...list].sort((a, b) => a - b);\n';

const gitEnv = (home) => {
  const env = { ...process.env, HOME: home, USERPROFILE: home, GIT_CONFIG_NOSYSTEM: '1', STARCI_RUNTIME: ROOT };
  for (const key of GIT_ENV_KEYS) delete env[key];
  return env;
};

const git = (repo, env, ...args) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', env, timeout: 90_000, windowsHide: true });
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

test('the generated pre-commit hook runs the sonar-rules self-check on the staged files, with no skip switch', () => {
  const hook = renderRuntimeHooks({ root: ROOT })['pre-commit'];
  assert.match(hook, /runtime check --only sonar-rules -- --staged --root "\$\(git rev-parse --show-toplevel\)" \|\| exit 1/);
  assert.match(hook, /git diff --cached --name-only --diff-filter=ACMRD -- '\*\.mjs'/);
  assert.doesNotMatch(hook, /SKIP|NO_VERIFY|SONAR_OFF/i);
});

test('a commit staging a new finding is refused and names it; the fix goes through; a fixed-but-listed entry is refused until deleted', { timeout: 240_000 }, (t) => {
  const available = spawnSync('git', ['--version'], { encoding: 'utf8', windowsHide: true });
  if (available.error?.code === 'ENOENT') return t.skip('git is not installed');

  const fixture = mkdtemp(t, 'starci-sonar-hook-');
  const repo = path.join(fixture, 'repo');
  const home = path.join(fixture, 'home');
  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  const env = gitEnv(home);
  gitOk(repo, env, 'init', '--quiet', '-b', 'main');
  for (const [name, value] of [['user.name', 'StarCi sonar hook'], ['user.email', 'sonar-hook@starci.test'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']]) gitOk(repo, env, 'config', '--local', name, value);
  const installed = installGitHooks({ root: repo, hooksDir: path.join(repo, '.git', 'hooks'), templateRoot: ROOT });
  assert.equal(installed.ok, true);

  put(repo, 'sonar-project.properties', PROPERTIES);
  put(repo, 'src/old.mjs', SORTS);
  gitOk(repo, env, 'add', 'sonar-project.properties');
  gitOk(repo, env, 'commit', '--quiet', '-m', 'scope only');
  const init = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'checks', 'check-sonar-rules.mjs'), '--root', repo, '--init'], { encoding: 'utf8', env, windowsHide: true });
  assert.equal(init.status, 0, init.stderr);
  gitOk(repo, env, 'add', 'src/old.mjs', 'modules/kernel/allowlist.yaml');
  const listed = git(repo, env, 'commit', '--quiet', '-m', 'the existing finding, listed');
  if (/cannot (?:run|spawn).*pre-commit|pre-commit.*No such file or directory/i.test(`${listed.stdout}${listed.stderr}`)) return t.skip('the shell required to execute git hooks is not installed');
  assert.equal(listed.status, 0, `a listed finding commits\n${listed.stdout}${listed.stderr}`);

  put(repo, 'src/new.mjs', `\n${SORTS}`);
  gitOk(repo, env, 'add', 'src/new.mjs');
  const refused = git(repo, env, 'commit', '-m', 'a new finding');
  assert.notEqual(refused.status, 0, 'a staged file carrying a new finding must make the hook fail');
  assert.match(`${refused.stdout}\n${refused.stderr}`, /S2871 src\/new\.mjs:2 Provide a compare function/);

  put(repo, 'src/new.mjs', CLEAN);
  gitOk(repo, env, 'add', 'src/new.mjs');
  assert.equal(git(repo, env, 'commit', '--quiet', '-m', 'the fixed form').status, 0);

  put(repo, 'src/old.mjs', CLEAN);
  gitOk(repo, env, 'add', 'src/old.mjs');
  const stale = git(repo, env, 'commit', '-m', 'fixed, entry kept');
  assert.notEqual(stale.status, 0, 'a fix that leaves its baseline entry listed is refused');
  assert.match(`${stale.stdout}\n${stale.stderr}`, /RT_SONAR_BASELINE_STALE src\/old\.mjs/);

  spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'checks', 'check-sonar-rules.mjs'), '--root', repo, '--prune'], { encoding: 'utf8', env, windowsHide: true });
  gitOk(repo, env, 'add', '-A');
  const fixed = git(repo, env, 'commit', '--quiet', '-m', 'fixed, entry deleted');
  assert.equal(fixed.status, 0, `${fixed.stdout}${fixed.stderr}`);
});
