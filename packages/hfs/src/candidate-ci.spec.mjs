// The candidate CI of `starci app release push`: the exact sha goes to its candidate ref, and only a green ci.yml run of that sha (or the owner's
// sha-bound override record) lets the default branch and the tag move. Every subprocess and the clock are fakes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { candidateRef, candidateStep, candidateVerdict, overrideOf, waitForCandidate } from '../release/candidate-ci.mjs';

const HEAD = 'a'.repeat(40);
const WAIT = Object.freeze({ pollSeconds: 30, graceMinutes: 10, waitMinutes: 90 });
const row = (overrides = {}) => ({ databaseId: 7, headSha: HEAD, status: 'completed', conclusion: 'success', url: 'https://example.invalid/runs/7', event: 'push', createdAt: '2026-10-18T00:00:00Z', ...overrides });

/** A fake ctx: `reads` is the list of gh run list replies in order (the last one repeats); the clock advances by each sleep. */
function fakeCtx({ reads = [[row()]], jobs = { jobs: [] }, push = { status: 0 }, common = null } = {}) {
  const calls = [];
  let clock = 0;
  let index = 0;
  const spawn = (command, args) => {
    calls.push([command, ...args]);
    if (command === 'git' && args[0] === 'push') return push;
    if (command === 'git' && args[0] === 'rev-parse') return common ? { status: 0, stdout: common } : { status: 128, stdout: '' };
    if (command === 'gh' && args[1] === 'list') {
      const reply = reads[Math.min(index, reads.length - 1)];
      index += 1;
      return reply === null ? { status: 1, stdout: '', stderr: 'gh: not logged in' } : { status: 0, stdout: JSON.stringify(reply) };
    }
    if (command === 'gh' && args[1] === 'view') return { status: 0, stdout: JSON.stringify(jobs) };
    throw new Error(`unexpected ${command} ${args.join(' ')}`);
  };
  return { calls, ctx: { cwd: '/app', spawn, now: () => clock, sleep: async (ms) => { clock += ms; } } };
}

test('the candidate ref names the version without the tag prefix', () => {
  assert.equal(candidateRef('v0.2.3', 'v'), 'refs/heads/release/candidate-0.2.3');
  assert.equal(candidateRef('rel1.0.0', 'rel'), 'refs/heads/release/candidate-1.0.0');
});

test('the newest non-cancelled run of the sha decides; no run is pending', () => {
  assert.equal(candidateVerdict([]).state, 'pending');
  assert.equal(candidateVerdict([row({ conclusion: 'cancelled' })]).state, 'pending');
  assert.equal(candidateVerdict([row({ status: 'in_progress', conclusion: null })]).state, 'running');
  assert.equal(candidateVerdict([row({ conclusion: 'failure' })]).state, 'red');
  const newer = row({ databaseId: 8, createdAt: '2026-10-18T01:00:00Z' });
  assert.equal(candidateVerdict([row({ conclusion: 'failure' }), newer]).run.databaseId, 8);
});

test('a green candidate pushes HEAD to the candidate ref first and reports the run', async () => {
  const { ctx, calls } = fakeCtx({ reads: [[], [row({ status: 'in_progress', conclusion: null })], [row()]] });
  const judged = await candidateStep(ctx, { head: HEAD, tag: 'v1.2.3', prefix: 'v', remote: 'origin', wait: WAIT });
  assert.equal(judged.ok, true);
  assert.equal(judged.data.state, 'green');
  assert.deepEqual(calls[0], ['git', 'push', 'origin', `+${HEAD}:refs/heads/release/candidate-1.2.3`]);
  assert.ok(calls.some((call) => call.join(' ') === `gh run list --workflow ci.yml --commit ${HEAD} --limit 20 --json databaseId,headSha,status,conclusion,url,event,createdAt`));
  assert.match(judged.lines.at(-1), /candidate CI {3}green https:\/\/example\.invalid\/runs\/7/);
});

test('a red candidate refuses and names the failing jobs and steps; nothing else is pushed', async () => {
  const jobs = { jobs: [{ name: 'test', conclusion: 'failure', steps: [{ name: 'unit', conclusion: 'failure' }, { name: 'checkout', conclusion: 'success' }] }, { name: 'fast', conclusion: 'success', steps: [] }] };
  const { ctx, calls } = fakeCtx({ reads: [[row({ conclusion: 'failure' })]], jobs });
  const judged = await candidateStep(ctx, { head: HEAD, tag: 'v1.2.3', prefix: 'v', remote: 'origin', wait: WAIT });
  assert.equal(judged.ok, false);
  assert.deepEqual(judged.data.failing, ['test (failure): unit']);
  assert.match(judged.lines.at(-1), /^RELEASE_CANDIDATE_CI_RED: .*failing: test \(failure\): unit\. Nothing reached the default branch/);
  assert.equal(calls.filter((call) => call[0] === 'git' && call[1] === 'push').length, 1, 'only the candidate push ran');
});

test('the owner override record of this exact sha lets a red candidate through and is reported', async (t) => {
  const common = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-candidate-'));
  t.after(() => fs.rmSync(common, { recursive: true, force: true }));
  fs.mkdirSync(path.join(common, 'starci-release'));
  const record = { schema: 'starci/ci-override@1', sha: HEAD, reason: 'flaky runner accepted', by: 'owner', at: '2026-10-18T00:00:00Z', runUrl: '' };
  fs.writeFileSync(path.join(common, 'starci-release', `${HEAD}.ci-override.json`), JSON.stringify(record));
  const { ctx } = fakeCtx({ reads: [[row({ conclusion: 'failure' })]], common });
  assert.equal(overrideOf(ctx, HEAD).reason, 'flaky runner accepted');
  assert.equal(overrideOf(ctx, 'b'.repeat(40)), null, 'an override is bound to its own sha');
  const judged = await candidateStep(ctx, { head: HEAD, tag: 'v1.2.3', prefix: 'v', remote: 'origin', wait: WAIT });
  assert.equal(judged.ok, true);
  assert.equal(judged.data.override.by, 'owner');
  assert.match(judged.lines.at(-1), /RELEASE_CANDIDATE_CI_RED overridden by the owner \(owner\): flaky runner accepted/);
});

test('no run within the grace refuses as a missing candidate trigger; an endless run times out; unreadable GitHub is unknown', async () => {
  const unstarted = await candidateStep(fakeCtx({ reads: [[]] }).ctx, { head: HEAD, tag: 'v1.0.0', prefix: 'v', remote: 'origin', wait: WAIT });
  assert.equal(unstarted.ok, false);
  assert.match(unstarted.lines.at(-1), /^RELEASE_CANDIDATE_CI_TIMEOUT: no ci\.yml run started .* release\/candidate-\*/);
  const endless = await waitForCandidate(fakeCtx({ reads: [[row({ status: 'in_progress', conclusion: null })]] }).ctx, HEAD, WAIT);
  assert.equal(endless.state, 'timeout');
  const blind = await candidateStep(fakeCtx({ reads: [null] }).ctx, { head: HEAD, tag: 'v1.0.0', prefix: 'v', remote: 'origin', wait: WAIT });
  assert.equal(blind.ok, false);
  assert.match(blind.lines.at(-1), /^RELEASE_CI_UNKNOWN/);
});

test('a refused candidate push stops before any wait', async () => {
  const { ctx, calls } = fakeCtx({ push: { status: 1, stderr: 'RIGHTS_PUSH_NOT_RELEASE: refused\n' } });
  const judged = await candidateStep(ctx, { head: HEAD, tag: 'v1.0.0', prefix: 'v', remote: 'origin', wait: WAIT });
  assert.equal(judged.ok, false);
  assert.equal(judged.data.state, 'push-failed');
  assert.equal(calls.filter((call) => call[0] === 'gh').length, 0);
});
