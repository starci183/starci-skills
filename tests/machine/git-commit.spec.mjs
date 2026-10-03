import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { gitCommit } from '../../scripts/machine/git-commit.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

function git(cwd, args) {
  const result = runGit(args, { cwd });
  assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
  return String(result.stdout ?? '').trim();
}

function repo(t, { lane = false } = {}) {
  const cwd = mkdtemp(t, 'starci-git-commit-');
  git(cwd, ['init', '--initial-branch=main']);
  git(cwd, ['config', 'user.name', 'StarCi Spec']);
  git(cwd, ['config', 'user.email', 'spec@starci.local']);
  fs.writeFileSync(path.join(cwd, 'readme.txt'), 'initial\n');
  git(cwd, ['add', '--', 'readme.txt']);
  git(cwd, ['commit', '-m', 'initial']);
  if (lane) git(cwd, ['switch', '-c', 'lane/git-a']);
  return cwd;
}

const context = (cwd, args, extra = {}) => ({ cwd, args, env: {}, role: 'lead', now: Date.UTC(2026, 9, 3), ...extra });

test('gitCommit stages explicit paths and writes the subject and trailers', async (t) => {
  const cwd = repo(t, { lane: true });
  fs.writeFileSync(path.join(cwd, 'change.txt'), 'change\n');
  const result = await gitCommit(context(cwd, {
    type: 'fix', scope: 'git', summary: 'preserve explicit paths', body: 'Keep unrelated files out.', paths: ['change.txt'],
    'co-author': 'Pair Author <pair@example.test>'
  }));

  assert.equal(result.code, 0);
  assert.match(result.text, /^committed [0-9a-f]{7} fix\(git\): preserve explicit paths$/);
  assert.equal(result.data.subject, 'fix(git): preserve explicit paths');
  assert.deepEqual(result.data.trailers, ['Co-Authored-By: Pair Author <pair@example.test>', 'Lane: lane/git-a']);
  assert.deepEqual(result.data.paths, ['change.txt']);
  const message = git(cwd, ['show', '-s', '--format=%B', 'HEAD']);
  assert.equal(message, 'fix(git): preserve explicit paths\n\nKeep unrelated files out.\n\nCo-Authored-By: Pair Author <pair@example.test>\nLane: lane/git-a');
});

test('gitCommit dry-run previews requested paths without changing HEAD or the index', async (t) => {
  const cwd = repo(t, { lane: true });
  fs.writeFileSync(path.join(cwd, 'preview.txt'), 'preview\n');
  const before = git(cwd, ['rev-parse', 'HEAD']);
  const result = await gitCommit(context(cwd, { type: 'docs', summary: 'preview a commit', paths: ['preview.txt'], 'dry-run': true }));

  assert.equal(result.code, 0);
  assert.match(result.text, /message:\ndocs: preview a commit/);
  assert.match(result.text, /staged:\npreview\.txt/);
  assert.equal(git(cwd, ['rev-parse', 'HEAD']), before);
  assert.equal(git(cwd, ['diff', '--cached', '--name-only']), '');
});

test('gitCommit refuses invalid subjects and main-branch commits with usage exit 2', async (t) => {
  const cases = [
    { name: 'bad type', args: { type: 'feature', summary: 'valid summary' }, match: /--type must be one of/ },
    { name: 'uppercase summary', args: { type: 'feat', summary: 'Starts uppercase' }, match: /start with a lowercase/ },
    { name: 'trailing period', args: { type: 'feat', summary: 'ends with a period.' }, match: /must not end with a period/ },
    { name: 'long subject', args: { type: 'feat', summary: `a${'b'.repeat(100)}` }, match: /maximum is 100/ },
    { name: 'main branch', args: { type: 'fix', summary: 'stay on a lane' }, match: /starci git sync.*lanes/ }
  ];
  for (const item of cases) {
    await t.test(item.name, async (st) => {
      const cwd = repo(st);
      const result = await gitCommit(context(cwd, item.args));
      assert.equal(result.code, 2);
      assert.match(result.text, item.match);
    });
  }
});

test('gitCommit refuses an empty staged index with findings exit 1', async (t) => {
  const cwd = repo(t, { lane: true });
  const result = await gitCommit(context(cwd, { type: 'chore', summary: 'record a change' }));
  assert.equal(result.code, 1);
  assert.match(result.text, /nothing to commit/);
});

test('gitCommit refuses missing and outside paths before staging', async (t) => {
  const root = mkdtemp(t, 'starci-git-commit-paths-');
  const cwd = path.join(root, 'repo');
  fs.mkdirSync(cwd);
  git(cwd, ['init', '--initial-branch=main']);
  git(cwd, ['config', 'user.name', 'StarCi Spec']);
  git(cwd, ['config', 'user.email', 'spec@starci.local']);
  fs.writeFileSync(path.join(cwd, 'readme.txt'), 'initial\n');
  git(cwd, ['add', '--', 'readme.txt']);
  git(cwd, ['commit', '-m', 'initial']);
  git(cwd, ['switch', '-c', 'lane/git-a']);
  fs.writeFileSync(path.join(root, 'outside.txt'), 'outside\n');

  const missing = await gitCommit(context(cwd, { type: 'fix', summary: 'reject a missing path', paths: ['missing.txt'] }));
  const outside = await gitCommit(context(cwd, { type: 'fix', summary: 'reject an outside path', paths: ['../outside.txt'] }));
  assert.equal(missing.code, 2);
  assert.match(missing.text, /path does not exist/);
  assert.equal(outside.code, 2);
  assert.match(outside.text, /outside the repository/);
});
