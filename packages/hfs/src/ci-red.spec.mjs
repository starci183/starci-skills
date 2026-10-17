// The release gate counts tag pushes reachable from resolved default-branch references without contacting GitHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { latestDefaultBranchCi, requireGreenCi } from '../release/ci-red.mjs';

const TIP = '6a1d8e80' + '0'.repeat(32);
const HEAD = 'b'.repeat(40);
const OTHER = 'c'.repeat(40);

function ciRun(overrides = {}) {
  return { databaseId: 42, headSha: TIP, headBranch: 'v0.2.1', event: 'push', status: 'completed', conclusion: 'failure', createdAt: '2026-10-18T00:00:00Z', url: 'https://example.invalid/runs/42', ...overrides };
}

/** All subprocesses are fake; absent refs and unspecified ancestry probes have distinct Git exit statuses. */
function fixture({ branch = [], pushes = [], refs = { 'origin/main': TIP, HEAD }, probes = {} } = {}) {
  const calls = [];
  const spawn = (command, args) => {
    calls.push({ command, args });
    if (command === 'gh') return { status: 0, stdout: JSON.stringify(args.includes('--branch') ? branch : pushes) };
    if (command === 'git' && args[0] === 'rev-parse') {
      const tip = refs[args[3].replace(/\^\{commit\}$/u, '')];
      return { status: tip ? 0 : 128, stdout: tip ?? '' };
    }
    if (command === 'git' && args[0] === 'merge-base') return { status: probes[args[3]] ?? 1 };
    throw new Error('Unexpected subprocess');
  };
  return { calls, read: (options = {}) => latestDefaultBranchCi({ spawn, cwd: 'release-worktree', ...options }) };
}

test('NIVO tag push failure on origin/main is red when local main is absent', () => {
  const { read, calls } = fixture({ pushes: [ciRun()] });
  const ci = read();
  assert.equal(ci.state, 'red');
  assert.equal(ci.run.databaseId, 42);
  assert.deepEqual(calls.filter((call) => call.args[0] === 'rev-parse').map((call) => call.args), [
    ['rev-parse', '--verify', '--quiet', 'origin/main^{commit}'],
    ['rev-parse', '--verify', '--quiet', 'main^{commit}'],
    ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'],
  ]);
  assert.equal(calls.filter((call) => call.args[0] === 'merge-base').length, 0);
  assert.throws(() => requireGreenCi({ spawn: () => ({ status: 128 }), cwd: 'release-worktree' }, ci), /RELEASE_CI_RED/);
});

test('NIVO tag push success on origin/main is green when local main is absent', () => {
  assert.equal(fixture({ pushes: [ciRun({ conclusion: 'success' })] }).read().state, 'green');
});

test('a newer push not reachable from any reference is ignored', () => {
  const older = ciRun({ databaseId: 41, conclusion: 'success' });
  const newer = ciRun({ headSha: OTHER, createdAt: '2026-10-18T01:00:00Z' });
  const ci = fixture({ pushes: [newer, older] }).read();
  assert.equal(ci.state, 'green');
  assert.equal(ci.run.databaseId, 41);
});

test('no resolved reference gives the ancestry unknown message', () => {
  const ci = fixture({ pushes: [ciRun()], refs: {} }).read();
  assert.deepEqual(ci, { state: 'unknown', why: 'cannot establish push run ancestry on the default branch (refs: none)' });
});

test('duplicate databaseIds count once with the branch row taking precedence', () => {
  const branch = ciRun({ status: 'in_progress', conclusion: null });
  const older = ciRun({ databaseId: 41, createdAt: '2026-10-17T00:00:00Z', conclusion: 'success' });
  const ci = fixture({ branch: [branch, older], pushes: [ciRun(), older] }).read();
  assert.equal(ci.state, 'green');
  assert.equal(ci.run.databaseId, 41);
});

test('a push ancestor of HEAD counts even when the origin probe errors', () => {
  const ci = fixture({ pushes: [ciRun({ headSha: OTHER })], probes: { [TIP]: 128, [HEAD]: 0 } }).read();
  assert.equal(ci.state, 'red');
});

test('a definite negative probe keeps ancestry known despite another probe error', () => {
  const ci = fixture({ pushes: [ciRun({ headSha: OTHER })], probes: { [TIP]: 128, [HEAD]: 1 } }).read();
  assert.deepEqual(ci, { state: 'unknown', why: 'no completed CI run on the default branch (refs: origin/main, HEAD)' });
});

test('every probe error makes ancestry unknown and lists resolved refs', () => {
  const ci = fixture({ pushes: [ciRun({ headSha: OTHER })], probes: { [TIP]: 128, [HEAD]: 128 } }).read();
  assert.deepEqual(ci, { state: 'unknown', why: 'cannot establish push run ancestry on the default branch (refs: origin/main, HEAD)' });
});

test('branch runs remain candidates even when no reference resolves', () => {
  assert.equal(fixture({ branch: [ciRun()], refs: {} }).read().state, 'red');
});

test('a custom default branch resolves its remote and local refs once', () => {
  const { read, calls } = fixture({ pushes: [ciRun()], refs: { trunk: TIP } });
  assert.equal(read({ defaultBranch: 'trunk' }).state, 'red');
  assert.deepEqual(calls.filter((call) => call.args[0] === 'rev-parse').map((call) => call.args[3]), ['origin/trunk^{commit}', 'trunk^{commit}', 'HEAD^{commit}']);
});
