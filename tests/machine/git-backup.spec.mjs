import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { gitBackup } from '../../scripts/machine/git-backup.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

function git(cwd, args, expected = 0) {
  const result = runGit(args, { cwd });
  assert.equal(result.status, expected, `${args.join(' ')}: ${result.stderr}`);
  return String(result.stdout ?? '').trim();
}

function fixture(t) {
  const root = mkdtemp(t, 'starci-git-backup-');
  const cwd = path.join(root, 'repo');
  const bare = path.join(root, 'origin.git');
  fs.mkdirSync(cwd);
  git(root, ['init', '--bare', bare]);
  git(cwd, ['init', '--initial-branch=main']);
  git(cwd, ['config', 'user.name', 'StarCi Spec']);
  git(cwd, ['config', 'user.email', 'spec@starci.local']);
  fs.writeFileSync(path.join(cwd, 'readme.txt'), 'initial\n');
  git(cwd, ['add', '--', 'readme.txt']);
  git(cwd, ['commit', '-m', 'initial']);
  git(cwd, ['switch', '-c', 'lane/git-a']);
  fs.writeFileSync(path.join(cwd, 'lane.txt'), 'lane\n');
  git(cwd, ['add', '--', 'lane.txt']);
  git(cwd, ['commit', '-m', 'lane change']);
  git(cwd, ['remote', 'add', 'origin', bare]);
  return { cwd, bare };
}

const NOW = Date.UTC(2026, 9, 3, 23, 59, 59);
const context = (cwd, args = {}) => ({ cwd, args, env: {}, role: 'coordinator', now: NOW });

test('gitBackup pushes current and main only to dated backup refs', async (t) => {
  const { cwd, bare } = fixture(t);
  const result = await gitBackup(context(cwd));
  assert.equal(result.code, 0);
  assert.deepEqual(result.data.refs, ['refs/backup/2026-10-03/lane/git-a', 'refs/backup/2026-10-03/main']);
  assert.equal(git(bare, ['rev-parse', '--verify', 'refs/backup/2026-10-03/lane/git-a']), git(cwd, ['rev-parse', 'refs/heads/lane/git-a']));
  assert.equal(git(bare, ['rev-parse', '--verify', 'refs/backup/2026-10-03/main']), git(cwd, ['rev-parse', 'refs/heads/main']));
  assert.equal(git(bare, ['for-each-ref', '--format=%(refname)', 'refs/heads']), '');
  assert.equal(git(bare, ['for-each-ref', '--format=%(refname)', 'refs/tags']), '');
});

test('gitBackup dry-run prints refspecs and creates no remote refs', async (t) => {
  const { cwd, bare } = fixture(t);
  const result = await gitBackup(context(cwd, { branches: ['main'], 'dry-run': true }));
  assert.equal(result.code, 0);
  assert.match(result.text, /refs\/heads\/main:refs\/backup\/2026-10-03\/main/);
  assert.equal(git(bare, ['for-each-ref', '--format=%(refname)']), '');
});

test('gitBackup table-driven refusals reject unknown remotes and force refspecs', async (t) => {
  const { cwd } = fixture(t);
  const cases = [
    { name: 'unknown remote', args: { remote: 'missing' }, match: /remote is not configured: missing/ },
    { name: 'force refspec', args: { branches: ['+main'] }, match: /force refspecs are forbidden/ }
  ];
  for (const item of cases) {
    await t.test(item.name, async () => {
      const result = await gitBackup(context(cwd, item.args));
      assert.equal(result.code, 2);
      assert.match(result.text, item.match);
    });
  }
});
