// push-mains' scratch push (scripts/supervisor/push-mains.mjs, cluster push-hooks-test-inflight-tree
// 2026-09-24): main is pushed from a scratch worktree of the committed main, never from the live product
// checkout, whose pre-push hook (husky: `npm run lint:check && npm run test:unit`) runs against the WORKING
// TREE. A running op worker's uncommitted edit made nivo-backend's hook red for 42 unit tests no commit
// held, and nivo stopped pushing altogether. The fixture is a temp repository with the husky v9 layout
// every product repo has — `.husky/pre-push` tracked, the `.husky/_` shim directory installed and
// gitignored, `core.hooksPath=.husky/_` — a fake lint that is red only where LINT_ERROR is, a real
// node_modules (root and one workspace package) and a bare `origin`. Nothing here touches a real repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pushMain, pushFromScratch, nodeModulesRoots, describePush } from '../scripts/supervisor/push-mains.mjs';

const json = (value) => JSON.stringify(value, null, 2);
const gitIn = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
const gitOk = (cwd, ...args) => {
  const r = gitIn(cwd, ...args);
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
/** The scratch directory the push reported, asserted gone: the whole scratch, not just its worktree. */
const assertScratchRemoved = (r) => {
  assert.ok(r.scratch, `the push reports the scratch it used: ${JSON.stringify(r)}`);
  assert.equal(fs.existsSync(r.scratch), false, `the scratch directory is removed: ${r.scratch}`);
};

// husky v9's installed shim, verbatim: git runs `.husky/_/pre-push`, which re-runs the tracked
// `.husky/pre-push` from the working tree the push is made in.
const HUSKY_H = [
  '#!/usr/bin/env sh',
  '[ "$HUSKY" = "2" ] && set -x',
  'n=$(basename "$0")',
  's=$(dirname "$(dirname "$0")")/$n',
  '',
  '[ ! -f "$s" ] && exit 0',
  '',
  'i="${XDG_CONFIG_HOME:-$HOME/.config}/husky/init.sh"',
  '[ -f "$i" ] && . "$i"',
  '',
  '[ "${HUSKY-}" = "0" ] && exit 0',
  '',
  'export PATH="node_modules/.bin:$PATH"',
  'sh -e "$s" "$@"',
  'c=$?',
  '',
  '[ $c != 0 ] && echo "husky - $n script failed (code $c)"',
  '[ $c = 127 ] && echo "husky - command not found in PATH=$PATH"',
  'exit $c',
  '',
].join('\n');
const HUSKY_SHIM = ['#!/usr/bin/env sh', '. "$(dirname "$0")/h"', ''].join('\n');

// The stand-in for `eslint "src/**/*.ts"`: it records the directory it judged and exits 1 on LINT_ERROR,
// so the spec can prove WHICH tree the hook ran against.
const lintScript = (marker) => [
  "import fs from 'node:fs';",
  "import path from 'node:path';",
  'const cwd = process.cwd();',
  `fs.appendFileSync(${JSON.stringify(marker)}, JSON.stringify({ cwd }) + '\\n');`,
  "const src = path.join(cwd, 'src');",
  "const bad = fs.readdirSync(src).filter((f) => f.endsWith('.ts') && fs.readFileSync(path.join(src, f), 'utf8').includes('LINT_ERROR'));",
  "if (bad.length) { console.error('lint:check: LINT_ERROR in ' + bad.join(', ')); process.exit(1); }",
  "console.log('lint:check: ok ' + cwd);",
  '',
].join('\n');

/** A temp product repository (bare origin, husky layout, node_modules, fake lint) + one baseline on origin. */
const fixture = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-push-scratch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const origin = path.join(root, 'origin.git');
  const repo = path.join(root, 'work');
  const marker = path.join(root, 'hook-runs.log');
  fs.mkdirSync(repo, { recursive: true });
  gitOk(root, 'init', '--bare', '--quiet', origin);
  gitOk(repo, 'init', '--quiet', '-b', 'main');
  gitOk(repo, 'config', 'user.email', 'lane@starci.test');
  gitOk(repo, 'config', 'user.name', 'lane');
  gitOk(repo, 'config', 'core.autocrlf', 'false');
  gitOk(repo, 'config', 'core.hooksPath', '.husky/_');
  gitOk(repo, 'remote', 'add', 'origin', origin);
  const write = (rel, body) => { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), body); };
  write('package.json', json({ name: 'inflight', private: true, workspaces: ['apps/*'], scripts: { 'lint:check': 'node scripts/lint-check.mjs', 'test:unit': 'node -e "process.exit(0)"' } }));
  write('scripts/lint-check.mjs', lintScript(marker));
  write('src/a.ts', 'export const a = 1;\n');
  write('.husky/pre-push', 'npm run lint:check && npm run test:unit\n');
  write('.husky/_/h', HUSKY_H);
  write('.husky/_/pre-push', HUSKY_SHIM);
  write('.husky/_/.gitignore', '*\n');
  write('.gitignore', 'node_modules/\n');
  write('node_modules/keep.txt', 'live deps\n');
  write('apps/app/node_modules/keep.txt', 'live app deps\n');
  const commit = (rel, body, message = `edit ${rel}`) => { write(rel, body); gitOk(repo, 'add', rel); gitOk(repo, 'commit', '--quiet', '-m', message); return gitOk(repo, 'rev-parse', 'HEAD'); };
  return {
    root, origin, repo, marker, write, commit,
    baseline: () => { gitOk(repo, 'add', '.'); gitOk(repo, 'commit', '--quiet', '-m', 'init'); gitOk(repo, 'push', '--quiet', '-u', 'origin', 'main'); },
    hookRuns: () => { try { return fs.readFileSync(marker, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } }); } catch { return []; } },
    worktrees: () => gitOk(repo, 'worktree', 'list', '--porcelain').split(/\r?\n/).filter((l) => l.startsWith('worktree ')).length,
  };
};

test('push-mains: main is pushed from a scratch worktree of the commit, green while the live tree is mid-edit', (t) => {
  const fx = fixture(t);
  fx.baseline();
  const head = fx.commit('src/b.ts', 'export const b = 1;\n');
  assert.equal(Number(gitOk(fx.repo, 'rev-list', '--count', 'origin/main..main')), 1, 'one commit is ahead');

  // The worker's in-flight edit: the live tree's hook sees it, no commit holds it.
  fx.write('src/a.ts', 'export const a = 1; // LINT_ERROR\n');
  const live = gitIn(fx.repo, 'push', 'origin', 'main');
  assert.notEqual(live.status, 0, 'the defect: the live checkout is red for an edit the commit does not hold');
  assert.match(live.stderr, /LINT_ERROR/);
  assert.notEqual(gitOk(fx.repo, 'rev-parse', 'origin/main'), head, 'the refused push moved nothing');

  const runs = fx.hookRuns().length;
  const r = pushMain(fx.repo);
  assert.equal(r.ahead, 1);
  assert.equal(r.pushed, true, JSON.stringify(r));
  assert.equal(r.via, 'scratch', 'the push ran from the scratch, not the live tree');
  assert.equal(r.deferred, undefined);
  assert.ok(head.startsWith(r.head), `head ${r.head} is the pushed commit ${head}`);
  assert.equal(gitOk(fx.repo, 'rev-parse', 'origin/main'), head, 'the committed main reached origin');

  const judged = fx.hookRuns().slice(runs).map((e) => path.resolve(e.cwd));
  assert.ok(judged.length > 0, 'the pre-push hook ran for the scratch push');
  assert.ok(judged.every((c) => c !== path.resolve(fx.repo)), `the hook never judged the live tree: ${judged.join(', ')}`);
  assert.ok(judged.every((c) => !fs.existsSync(c)), 'the scratch it judged is gone');
  assert.equal(fx.worktrees(), 1, 'no scratch worktree is left behind');
  assertScratchRemoved(r);
  assert.ok(fs.existsSync(path.join(fx.repo, 'node_modules', 'keep.txt')) && fs.existsSync(path.join(fx.repo, 'apps', 'app', 'node_modules', 'keep.txt')),
    'the live dependencies were never walked into');
  assert.match(gitOk(fx.repo, 'status', '--porcelain', '--untracked-files=no'), /src\/a\.ts/, 'the live tree is left exactly as the worker left it');
});

test('push-mains: a red commit is a failed push from the scratch, never a --no-verify one', (t) => {
  const fx = fixture(t);
  fx.baseline();
  fx.commit('src/bad.ts', 'export const b = 1; // LINT_ERROR\n', 'commit the lint error into main');
  assert.equal(gitOk(fx.repo, 'status', '--porcelain', '--untracked-files=no'), '', 'the live tree itself is clean');
  const runs = fx.hookRuns().length;
  const r = pushMain(fx.repo);
  assert.equal(r.pushed, false, JSON.stringify(r));
  assert.equal(r.deferred, undefined, 'a clean tree is never deferred: this main is genuinely red');
  assert.match(String(r.error), /LINT_ERROR/, 'the hook\'s own refusal is reported');
  assert.ok(fx.hookRuns().length > runs, 'the hook ran on the scratch, so hooks stayed on');
  assert.equal(fx.worktrees(), 1, 'the scratch is removed after a failed push too');
  assertScratchRemoved(r);
  assert.notEqual(gitOk(fx.repo, 'rev-parse', 'origin/main'), gitOk(fx.repo, 'rev-parse', 'main'));
});

test('push-mains: a repository whose scratch cannot be prepared defers a busy tree, never FAILED', (t) => {
  const fx = fixture(t);
  fx.baseline();
  const head = fx.commit('src/b.ts', 'export const b = 1;\n');
  const refused = () => ({ ok: false, unavailable: true, error: 'junction refused' });

  fx.write('src/a.ts', 'export const a = 1; // LINT_ERROR\n');
  const dirty = pushMain(fx.repo, { scratchPush: refused });
  assert.equal(dirty.pushed, false);
  assert.equal(dirty.deferred, 'in-flight tree');
  assert.deepEqual(dirty.detail, ['src/a.ts']);
  assert.equal(dirty.via, 'live');
  assert.equal(dirty.error, undefined, 'a busy tree is not a failed push');
  assert.match(describePush(dirty), /deferred: in-flight tree/);
  assert.doesNotMatch(describePush(dirty), /FAILED/);
  assert.notEqual(gitOk(fx.repo, 'rev-parse', 'origin/main'), head, 'nothing was pushed while the tree was busy');
  assert.equal(fx.worktrees(), 1, 'the refused scratch left no worktree');

  // A clean tree judges the commit itself, so without a scratch the push still goes out.
  fx.write('src/a.ts', 'export const a = 1;\n');
  const clean = pushMain(fx.repo, { scratchPush: refused });
  assert.equal(clean.pushed, true, JSON.stringify(clean));
  assert.equal(clean.via, 'live');
  assert.equal(gitOk(fx.repo, 'rev-parse', 'origin/main'), head);
});

test('push-mains: a dry run stops at the scan, no worktree and no push', (t) => {
  const fx = fixture(t);
  fx.baseline();
  fx.commit('src/b.ts', 'export const b = 1;\n');
  const r = pushMain(fx.repo, { dryRun: true });
  assert.equal(r.wouldPush, true);
  assert.equal(r.pushed, false);
  assert.equal(r.ahead, 1);
  assert.equal(fx.worktrees(), 1);
  assert.notEqual(gitOk(fx.repo, 'rev-parse', 'origin/main'), gitOk(fx.repo, 'rev-parse', 'main'));
});

test('pushFromScratch: a repository it cannot prepare is unavailable, never a failed push', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-push-nogit-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const r = pushFromScratch(dir);
  assert.equal(r.ok, false);
  assert.equal(r.unavailable, true);
  assert.ok(r.error, 'the reason is reported');
  assertScratchRemoved(r);
});

test('the layout read: the checkout root and every workspace package that has its own node_modules', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-push-nm-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const mk = (rel) => fs.mkdirSync(path.join(dir, rel), { recursive: true });
  mk('node_modules/pkg');
  mk('node_modules/pkg/node_modules/nested');
  mk('apps/app/node_modules/pkg');
  mk('apps/expert/src');
  mk('.next/node_modules/hidden');
  assert.deepEqual(nodeModulesRoots(dir).map((p) => path.relative(dir, p).replace(/\\/g, '/')).sort(),
    ['apps/app/node_modules', 'node_modules'], 'root plus the workspace package that keeps its own; never inside a node_modules or a hidden directory');
});