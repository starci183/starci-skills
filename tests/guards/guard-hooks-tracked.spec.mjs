// guard-hooks-tracked.spec.mjs — the history hook installs in a linked worktree of a husky repo.
//
// Live defect: core.hooksPath is husky's relative `.husky/_`, which git resolves per checkout.
// husky generates that directory (with its own `.gitignore` of `*`) only in the checkout `npm install` ran in, so an
// op's linked worktree under .starciwork/worktrees had none, and ensureHistoryHook refused with hooks-dir-tracked:
// every product dispatch ran without the reference-transaction guard. An absent, untracked hooks dir now gets husky's
// own self-ignoring layout; a hooks dir the product really tracks stays refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ensureHistoryHook } from '../../scripts/guards/hook-install.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { WORKTREES_EXCLUDE_LINE } from '../../scripts/lib/worktree-exclude.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_CONFIG_PARAMETERS', 'GIT_CONFIG_COUNT', 'GIT_PREFIX']) delete process.env[key];

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const sh = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });

const huskyRepo = (t) => {
  const base = mkdtemp(t, 'starci-husky-');
  const repo = path.join(base, 'repo');
  fs.mkdirSync(repo);
  for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.email', 't@t'], ['config', 'user.name', 't'], ['config', 'commit.gpgsign', 'false'], ['config', 'core.hooksPath', '.husky/_']]) sh(repo, args);
  fs.mkdirSync(path.join(repo, '.husky'));
  fs.writeFileSync(path.join(repo, '.husky', 'pre-push'), 'npm test\n');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  assert.equal(sh(repo, ['add', '.']).status, 0);
  assert.equal(sh(repo, ['commit', '-q', '-m', 'base']).status, 0);
  // what `husky` (npm prepare) generates in the main checkout only
  fs.mkdirSync(path.join(repo, '.husky', '_'));
  fs.writeFileSync(path.join(repo, '.husky', '_', '.gitignore'), '*');
  // what the runtime does in a real product repo (scripts/machine/worktrees.mjs): the worktrees dir is git-excluded, so the main
  // checkout's status stays about the hooks dir, not the runtime trees living under it
  fs.appendFileSync(path.join(repo, '.git', 'info', 'exclude'), `${WORKTREES_EXCLUDE_LINE}
`);
  const wt = path.join(repo, '.starciwork', 'worktrees', 'wf', 'op1');
  assert.equal(sh(repo, ['worktree', 'add', '-q', '-b', 'op/op1', wt]).status, 0);
  return { repo, wt };
};

test('a linked worktree of a husky repo gets the history hook, and nothing new to track', (t) => {
  const { wt } = huskyRepo(t);
  assert.equal(fs.existsSync(path.join(wt, '.husky', '_')), false, 'fixture: husky never ran in the worktree');
  const hook = ensureHistoryHook(wt, { skillRoot: ROOT });
  assert.equal(hook.installed, true, JSON.stringify(hook));
  assert.equal(path.resolve(hook.path), path.resolve(wt, '.husky', '_', 'reference-transaction'));
  assert.equal(sh(wt, ['status', '--porcelain']).stdout.trim(), '', 'no file offered for tracking');
  assert.equal(ensureHistoryHook(wt, { skillRoot: ROOT }).changed, false, 'idempotent');
  // the guard is live in that worktree
  fs.writeFileSync(path.join(wt, 'a.txt'), 'b\n');
  assert.equal(sh(wt, ['commit', '-q', '-am', 'x']).status, 0);
  const amend = sh(wt, ['commit', '--amend', '-q', '-m', 'rewritten']);
  assert.notEqual(amend.status, 0, 'amend on the worktree branch is refused');
  assert.match(amend.stderr, /starci history guard: refused moving protected branch op\/op1/);
});

test('the main checkout of a husky repo still installs into husky\'s ignored dir', (t) => {
  const { repo } = huskyRepo(t);
  const hook = ensureHistoryHook(repo, { skillRoot: ROOT });
  assert.equal(hook.installed, true, JSON.stringify(hook));
  assert.equal(sh(repo, ['status', '--porcelain']).stdout.trim(), '');
});

test('a hooks dir the product tracks, or one holding untracked files, stays refused', (t) => {
  const { repo, wt } = huskyRepo(t);
  // tracked hooks dir
  const base = path.dirname(repo);
  const tracked = path.join(base, 'tracked');
  fs.mkdirSync(tracked);
  for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.email', 't@t'], ['config', 'user.name', 't'], ['config', 'commit.gpgsign', 'false'], ['config', 'core.hooksPath', 'hooks']]) sh(tracked, args);
  fs.mkdirSync(path.join(tracked, 'hooks'));
  fs.writeFileSync(path.join(tracked, 'hooks', 'pre-commit'), '#!/bin/sh\n');
  sh(tracked, ['add', '.']);
  sh(tracked, ['commit', '-q', '-m', 'base']);
  assert.equal(ensureHistoryHook(tracked, { skillRoot: ROOT }).reason, 'hooks-dir-tracked');
  assert.equal(fs.existsSync(path.join(tracked, 'hooks', '.gitignore')), false);
  // an existing, non-empty, unignored hooks dir in the worktree is left alone
  fs.mkdirSync(path.join(wt, '.husky', '_'));
  fs.writeFileSync(path.join(wt, '.husky', '_', 'pre-commit'), '#!/bin/sh\n');
  assert.equal(ensureHistoryHook(wt, { skillRoot: ROOT }).reason, 'hooks-dir-tracked');
  assert.equal(fs.existsSync(path.join(wt, '.husky', '_', '.gitignore')), false);
});
