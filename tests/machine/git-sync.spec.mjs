import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { gitSync } from '../../scripts/machine/git-sync.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

function git(cwd, args, expected = 0) {
  const result = runGit(args, { cwd });
  assert.equal(result.status, expected, `${args.join(' ')}: ${result.stderr}`);
  return String(result.stdout ?? '').trim();
}

function repo(t) {
  const cwd = mkdtemp(t, 'starci-git-sync-');
  git(cwd, ['init', '--initial-branch=main']);
  git(cwd, ['config', 'user.name', 'StarCi Spec']);
  git(cwd, ['config', 'user.email', 'spec@starci.local']);
  fs.writeFileSync(path.join(cwd, 'shared.txt'), 'base\n');
  git(cwd, ['add', '--', 'shared.txt']);
  git(cwd, ['commit', '-m', 'initial']);
  git(cwd, ['switch', '-c', 'lane/git-a']);
  return cwd;
}

function conflictingRepo(t) {
  const cwd = repo(t);
  fs.writeFileSync(path.join(cwd, 'shared.txt'), 'lane\n');
  git(cwd, ['commit', '-am', 'lane change']);
  git(cwd, ['switch', 'main']);
  fs.writeFileSync(path.join(cwd, 'shared.txt'), 'main\n');
  git(cwd, ['commit', '-am', 'main change']);
  git(cwd, ['switch', 'lane/git-a']);
  return cwd;
}

const context = (cwd, args = {}) => ({ cwd, args, env: {}, role: 'lead', now: Date.UTC(2026, 9, 3) });

test('gitSync ignores untracked files and reports an up-to-date lane', async (t) => {
  const cwd = repo(t);
  fs.writeFileSync(path.join(cwd, 'untracked.txt'), 'leave me\n');
  const result = await gitSync(context(cwd));
  assert.equal(result.code, 0);
  assert.equal(result.text, 'up to date');
  assert.equal(fs.readFileSync(path.join(cwd, 'untracked.txt'), 'utf8'), 'leave me\n');
});

test('gitSync makes a no-fast-forward merge from local main', async (t) => {
  const cwd = repo(t);
  git(cwd, ['switch', 'main']);
  fs.writeFileSync(path.join(cwd, 'main.txt'), 'main\n');
  git(cwd, ['add', '--', 'main.txt']);
  git(cwd, ['commit', '-m', 'main change']);
  git(cwd, ['switch', 'lane/git-a']);

  const result = await gitSync(context(cwd));
  assert.equal(result.code, 0);
  assert.match(result.text, /^synced [0-9a-f]{7} from refs\/heads\/main$/);
  assert.equal(fs.existsSync(path.join(cwd, 'main.txt')), true);
  assert.equal(git(cwd, ['rev-list', '--parents', '-n', '1', 'HEAD']).split(' ').length, 3);
});

test('gitSync table-driven policy refusals name dirty paths and reject origin/main', async (t) => {
  await t.test('dirty tracked tree', async (st) => {
    const cwd = repo(st);
    fs.writeFileSync(path.join(cwd, 'shared.txt'), 'dirty\n');
    const result = await gitSync(context(cwd));
    assert.equal(result.code, 1);
    assert.match(result.text, /tracked worktree is dirty:\nshared\.txt/);
  });
  await t.test('remote-tracking main', async (st) => {
    const cwd = repo(st);
    const result = await gitSync(context(cwd, { 'main-ref': 'origin/main' }));
    assert.equal(result.code, 2);
    assert.match(result.text, /lanes merge the LOCAL main, never origin\/main/);
  });
});

test('gitSync leaves a real conflicting merge in progress and lists its path', async (t) => {
  const cwd = conflictingRepo(t);
  const result = await gitSync(context(cwd));
  assert.equal(result.code, 1);
  assert.match(result.text, /merge conflicts:\nshared\.txt/);
  assert.match(result.text, /resolve, then `starci git commit --type chore --summary \.\.\.`/);
  assert.equal(fs.existsSync(path.join(cwd, '.git', 'MERGE_HEAD')), true);
});

test('gitSync abort-on-conflict restores the clean lane tree', async (t) => {
  const cwd = conflictingRepo(t);
  const before = git(cwd, ['rev-parse', 'HEAD']);
  const result = await gitSync(context(cwd, { 'abort-on-conflict': true }));
  assert.equal(result.code, 1);
  assert.match(result.text, /merge aborted$/);
  assert.equal(git(cwd, ['rev-parse', 'HEAD']), before);
  assert.equal(git(cwd, ['status', '--porcelain', '--untracked-files=no']), '');
  assert.equal(fs.readFileSync(path.join(cwd, 'shared.txt'), 'utf8').replace(/\r\n/g, '\n'), 'lane\n');
  assert.equal(fs.existsSync(path.join(cwd, '.git', 'MERGE_HEAD')), false);
});

test('gitSync dry-run finds conflicts without touching the tree', async (t) => {
  const cwd = conflictingRepo(t);
  const before = git(cwd, ['rev-parse', 'HEAD']);
  const result = await gitSync(context(cwd, { 'dry-run': true }));
  assert.equal(result.code, 1);
  assert.match(result.text, /would conflict:\nshared\.txt/);
  assert.equal(git(cwd, ['rev-parse', 'HEAD']), before);
  assert.equal(git(cwd, ['status', '--porcelain', '--untracked-files=no']), '');
  assert.equal(fs.existsSync(path.join(cwd, '.git', 'MERGE_HEAD')), false);
});
