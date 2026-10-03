import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gitSpawn, runGit } from '../../scripts/api/git/lib.mjs';
import { gitResultOf, withoutGitLocalEnv } from '../../scripts/lib/git.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const gitResult = (args, options) => gitResultOf(runGit(args, options));

// Guard/kernel scripts each spelt the same git spawn by hand: encoding utf8, windowsHide, a cwd
// here, a `-C` there. scripts/lib/git.mjs is the one helper; gitSpawn keeps the
// (file, args, options) signature so injected runners and spec fakes take the same arguments.

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

test('gitSpawn runs the binary with utf8 output and options pass through', () => {
  const r = gitSpawn('git', ['rev-parse', '--is-inside-work-tree'], { cwd: ROOT, timeout: 20_000 });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'true');
});

test('runGit composes -C dir before the args; the cwd form spawns inside the dir', () => {
  const r = runGit(['rev-parse', '--show-toplevel'], { dir: ROOT });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim().replace(/\\/g, '/'), path.resolve(ROOT).replace(/\\/g, '/'));
  const inCwd = runGit(['rev-parse', '--is-inside-work-tree'], { cwd: ROOT });
  assert.equal(inCwd.stdout.trim(), 'true');
});

test('gitResultOf folds a git spawn result into {ok, stdout, error}', () => {
  const ok = gitResult(['rev-parse', '--verify', 'HEAD'], { dir: ROOT });
  assert.equal(ok.ok, true);
  assert.match(ok.stdout.trim(), /^[0-9a-f]{40}$/);
  // The owned-path-effects copy this replaces named a clean exit 'exit 0' in error; callers read
  // error only when ok is false, and the quirk is preserved verbatim.
  assert.equal(ok.error, 'exit 0');
  const bad = gitResult(['rev-parse', '--verify', 'no-such-ref-starci'], { dir: ROOT });
  assert.equal(bad.ok, false);
  assert.ok(bad.error.length > 0, 'stderr is named in error');
  const gone = gitResult(['--version'], { git: 'definitely-not-git-binary-xyz' });
  assert.equal(gone.ok, false);
  assert.ok(gone.error.length > 0, 'a spawn error is named, never thrown');
});

test('actual linked-worktree hook scopes nested Work and foreign-repository queries to their requested roots', (t) => {
  const fixture = mkdtemp(t, 'starci-git-hooks-e2e-');
  const source = path.join(fixture, 'source'), checkout = path.join(fixture, 'linked checkout'), foreign = path.join(fixture, 'foreign');
  const env = withoutGitLocalEnv(process.env);
  const git = (cwd, args, extra = {}) => {
    const result = runGit(args, { cwd, env, ...extra });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  for (const repo of [source, foreign]) {
    fs.mkdirSync(repo);
    git(repo, ['init', '--quiet', '-b', 'main']);
    git(repo, ['config', 'user.name', 'StarCi scoped Git test']);
    git(repo, ['config', 'user.email', 'scoped-git@starci.test']);
    git(repo, ['config', 'commit.gpgsign', 'false']);
  }
  const put = (base, file, value) => {
    const target = path.join(base, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  };
  put(source, '.starciwork/features/health/index.yaml', 'schema: work/feature@1\n');
  put(source, 'ui/evidence/actual-ui.txt', 'runtime UI content\n');
  git(source, ['add', '.']);
  git(source, ['commit', '--quiet', '-m', 'initial']);
  put(foreign, 'foreign.txt', 'foreign content\n');
  git(foreign, ['add', '.']);
  git(source, ['worktree', 'add', '--quiet', '-b', 'linked', checkout]);
  const output = path.join(fixture, 'hook-result.json');
  const probe = path.join(fixture, 'probe.mjs');
  const apiUrl = new URL('../../scripts/api/git/ls-files.mjs', import.meta.url).href;
  const boundaryUrl = new URL('../../scripts/work/validate/check-example-work.mjs', import.meta.url).href;
  fs.writeFileSync(probe, `import fs from 'node:fs';\nimport {lsFiles} from ${JSON.stringify(apiUrl)};\nimport {checkStarciworkBoundary} from ${JSON.stringify(boundaryUrl)};\nconst problems=[];\ncheckStarciworkBoundary(${JSON.stringify(path.join(checkout, '.starciwork'))},problems);\nconst nested=lsFiles(['-z','--','.'],{cwd:${JSON.stringify(path.join(checkout, '.starciwork'))}});\nconst foreign=lsFiles(['-z'],{dir:${JSON.stringify(foreign)}});\nfs.writeFileSync(${JSON.stringify(output)},JSON.stringify({hookGitDir:process.env.GIT_DIR,nested:nested.stdout,foreign:foreign.stdout,problems,status:[nested.status,foreign.status]}));\n`);
  const quote = (value) => `'${value.replaceAll("'", "'\\''").replaceAll('\\', '/')}'`;
  fs.writeFileSync(path.join(source, '.git/hooks/pre-commit'), `#!/bin/sh\n${quote(process.execPath)} ${quote(probe)}\n`, { mode: 0o755 });
  put(checkout, 'changed.txt', 'commit through actual hook\n');
  git(checkout, ['add', 'changed.txt']);
  git(checkout, ['commit', '--quiet', '-m', 'hook scopes queries']);
  const actual = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.ok(actual.hookGitDir, 'Git exported its linked-worktree repository directory to the real hook');
  assert.deepEqual(actual.status, [0, 0]);
  assert.equal(actual.nested, 'features/health/index.yaml\0');
  assert.equal(actual.foreign, 'foreign.txt\0');
  assert.deepEqual(actual.problems, [], 'runtime UI evidence is outside Work and must not be reported under it');
  put(checkout, '.starciwork/evidence/forbidden.txt', 'actual agent data\n');
  git(checkout, ['add', '.starciwork/evidence/forbidden.txt']);
  git(checkout, ['commit', '--quiet', '-m', 'real tracked boundary data']);
  const denied = JSON.parse(fs.readFileSync(output, 'utf8')).problems;
  assert.equal(denied.length, 1, JSON.stringify(denied));
  assert.match(denied[0], /HFS_AGENT_DATA_TRACKED/);
});

test('scoped calls preserve an explicitly selected temporary index without changing the real index', (t) => {
  const repo = mkdtemp(t, 'starci-git-hooks-e2e-');
  const env = withoutGitLocalEnv(process.env);
  const git = (args, supplied = env) => {
    const result = runGit(args, { cwd: repo, env: supplied });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  git(['init', '--quiet']);
  fs.writeFileSync(path.join(repo, 'real.txt'), 'real index\n');
  fs.writeFileSync(path.join(repo, 'snapshot.txt'), 'alternate index\n');
  git(['add', 'real.txt']);
  const alternate = { ...env, GIT_INDEX_FILE: path.join(repo, 'alternate.index') };
  git(['read-tree', '--empty'], alternate);
  git(['add', 'snapshot.txt'], alternate);
  assert.equal(git(['ls-files', '-z'], alternate), 'snapshot.txt\0');
  assert.equal(git(['ls-files', '-z']), 'real.txt\0');
});
