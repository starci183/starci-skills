// release-record.spec.mjs - the L4 record the pre-push hook looks for: written only for a green full suite and a release tag,
// read back only for the same head and tag, kept in the git common dir (shared by every worktree, never in the tree).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { gitCommonDir, l4RecordPath, readL4Record, writeL4Record } from '../../scripts/guards/release-record.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const HEAD = 'a'.repeat(40);
const GREEN = [{ name: 'npm test', ok: true, log: 'suite.log', ms: 10 }, { name: 'npm run check', ok: true, log: 'check.log', ms: 5 }];

test('a green full suite and a release tag write the record under <common dir>/starci-release/<head>.l4.json', (t) => {
  const commonDir = mkdtemp(t, 'l4-common-');
  const written = writeL4Record({ head: HEAD, tag: 'v1.0.0-alpha.4', logs: GREEN, commonDir, now: () => new Date('2026-10-03T00:00:00Z') });
  assert.equal(written.ok, true);
  assert.equal(written.file, l4RecordPath({ commonDir, head: HEAD }));
  assert.deepEqual(JSON.parse(fs.readFileSync(written.file, 'utf8')), { schema: 'starci/l4-record@1', head: HEAD, tag: 'v1.0.0-alpha.4', suite: 'local', delegated: [], logs: GREEN, at: '2026-10-03T00:00:00.000Z' });
});

test('nothing is written for a bad head, a non-release tag, a red or empty-of-proof step', (t) => {
  const commonDir = mkdtemp(t, 'l4-common-');
  const cases = [
    [{ head: 'abc', tag: 'v1.0.0', logs: GREEN }, 'the head is not a full sha'],
    [{ head: HEAD, tag: 'preserve/x', logs: GREEN }, 'the tag is not a release tag v<version>'],
    [{ head: HEAD, tag: 'latest', logs: GREEN }, 'the tag is not a release tag v<version>'],
    [{ head: HEAD, tag: 'v1.0.0', logs: [{ name: 'npm test', ok: false }] }, 'a suite step is not green'],
  ];
  for (const [input, reason] of cases) assert.deepEqual(writeL4Record({ ...input, commonDir }), { ok: false, reason }, reason);
  assert.equal(fs.existsSync(path.join(commonDir, 'starci-release')), false);
});

test('the record is read back only for the same head, tag and schema', (t) => {
  const commonDir = mkdtemp(t, 'l4-common-');
  assert.equal(readL4Record({ head: HEAD, commonDir }), null, 'no record yet');
  writeL4Record({ head: HEAD, tag: 'v1.0.0', logs: GREEN, commonDir });
  assert.equal(readL4Record({ head: HEAD, commonDir }).tag, 'v1.0.0');
  assert.equal(readL4Record({ head: HEAD, tag: 'v1.0.0', commonDir }).head, HEAD);
  assert.equal(readL4Record({ head: HEAD, tag: 'v9.9.9', commonDir }), null, 'another tag');
  assert.equal(readL4Record({ head: 'b'.repeat(40), commonDir }), null, 'another head');
  fs.writeFileSync(l4RecordPath({ commonDir, head: HEAD }), '{"schema":"other@1","head":"' + HEAD + '","tag":"v1.0.0"}');
  assert.equal(readL4Record({ head: HEAD, commonDir }), null, 'another schema');
  fs.writeFileSync(l4RecordPath({ commonDir, head: HEAD }), 'not json');
  assert.equal(readL4Record({ head: HEAD, commonDir }), null, 'unreadable');
});

test('the common dir of a real repository and of its linked worktree is the same, so one record serves every worktree', (t) => {
  const base = mkdtemp(t, 'l4-repo-');
  const repo = path.join(base, 'main');
  const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });
  fs.mkdirSync(repo);
  assert.equal(git(['init', '-q', '-b', 'main'], repo).status, 0);
  git(['config', 'user.email', 'a@b.c'], repo);
  git(['config', 'user.name', 'n'], repo);
  fs.writeFileSync(path.join(repo, 'f'), 'x');
  git(['add', '.'], repo);
  assert.equal(git(['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'one'], repo).status, 0);
  const linked = path.join(base, 'wt');
  assert.equal(git(['worktree', 'add', '-q', '--detach', linked], repo).status, 0);
  const a = gitCommonDir(repo);
  const b = gitCommonDir(linked);
  assert.ok(a && b);
  assert.equal(fs.realpathSync(a), fs.realpathSync(b));
  assert.equal(gitCommonDir(base), null, 'a directory that is no repository has no common dir');
  git(['worktree', 'remove', '--force', linked], repo);
});
