// release-record.spec.mjs - the L4 record the pre-push hook looks for: written only for a green full suite and a release tag,
// read back only for the same head and tag, kept in the git common dir (shared by every worktree, never in the tree).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { gitCommonDir, l4RecordPath, readL4Record, writeL4Record } from '../../scripts/guards/release-record.mjs';
import { judgedIn, LAND_NOTE_REF, proofBinds, proofDigest, proofDirOf, proofFileOf, proofFilesOf, readProofFile, writeProofFile } from '../../scripts/gates/commit-proof.mjs';
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

test('the proof of a commit has one home: <common dir>/starci-release/<sha>.<kind>.json, and the files of one kind are found by their suffix', (t) => {
  const commonDir = mkdtemp(t, 'starci-proof-kinds-');
  const dirOf = proofDirOf(commonDir);
  fs.mkdirSync(dirOf, { recursive: true });
  const kinds = { l4: 'l4', affected: 'affected', rows: 'l4-rows', ci: 'ci', report: 'affected-report' };
  for (const [kind, suffix] of Object.entries(kinds)) {
    assert.equal(proofFileOf({ commonDir, sha: HEAD, kind }), path.join(dirOf, `${HEAD}.${suffix}.json`));
    fs.writeFileSync(proofFileOf({ commonDir, sha: HEAD, kind }), '{}');
  }
  assert.deepEqual(proofFilesOf({ commonDir, kind: 'affected' }), [path.join(dirOf, `${HEAD}.affected.json`)], 'an affected report is not an affected ledger');
  assert.deepEqual(proofFilesOf({ commonDir: path.join(commonDir, 'absent'), kind: 'ci' }), []);
});

test('the same owner places state receipts and the land note without moving existing evidence', (t) => {
  const root = mkdtemp(t, 'starci-proof-state-');
  const state = path.join(root, 'host-state');
  const base = 'b'.repeat(40);
  assert.equal(proofFileOf({ kind: 'verify', root, sha: HEAD }), path.join(root, '.runtime', 'verify', `${HEAD}.json`));
  assert.equal(proofFileOf({ kind: 'affected-receipt', root, base, sha: HEAD }), path.join(root, '.runtime', 'affected', `${base.slice(0, 12)}-${HEAD.slice(0, 12)}.json`));
  assert.equal(proofFileOf({ kind: 'deploy', sha: HEAD, env: { STARCI_LOCAL_ROOT: state } }), path.join(state, 'deploy', 'receipts', `${HEAD}.json`));
  assert.equal(LAND_NOTE_REF, 'land');
  assert.throws(() => proofFileOf({ kind: 'unknown', commonDir: root, sha: HEAD }), /unknown commit proof kind/);
  assert.throws(() => proofFilesOf({ commonDir: root, kind: 'unknown' }), /unknown release proof kind/);
});

test('proof IO keeps complete documents and binding rejects another commit, tree or root', (t) => {
  const root = mkdtemp(t, 'starci-proof-io-');
  const file = proofFileOf({ kind: 'verify', root, sha: HEAD });
  const record = { schema: 'spec-proof@1', sha: HEAD, tree: 'tree', root };
  assert.equal(readProofFile(file), null);
  assert.equal(writeProofFile(file, record), file);
  assert.deepEqual(readProofFile(file), record);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), [`${HEAD}.json`], 'no incomplete temporary file remains');
  assert.equal(proofBinds(record, { sha: HEAD, tree: 'tree' }), true);
  assert.equal(proofBinds(record, { sha: 'other', tree: 'tree' }), false);
  assert.equal(proofBinds(record, { sha: HEAD, tree: 'other' }), false);
  assert.equal(judgedIn(root, root), true);
  assert.equal(judgedIn('', root), false);
  assert.equal(judgedIn(path.join(root, 'other'), root), false);
  assert.notEqual(proofDigest(['schema', HEAD, 'tree']), proofDigest(['schema', HEAD, 'other']));
  fs.writeFileSync(file, 'incomplete json');
  assert.equal(readProofFile(file), null);
});
