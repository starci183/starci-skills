// release.requireCi (owner ruling release-require-ci-per-project): an app chooses whether `starci app release push` waits for the candidate CI of
// the release sha. The default is false: the push still needs the annotated tag and the green L4 record and still runs `git push --dry-run --atomic`
// first, then pushes the branch and the tag atomically and says CI was not required. With true the candidate CI path runs as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempRoot } from '../runtime/engine/temp-root.mjs';
import { CI_NOT_REQUIRED, normalizeRelease } from '../release/gate.mjs';
import { releasePush } from '../release/push.mjs';

const HEAD = 'c'.repeat(40);
const TAG = 'v1.2.3';
const WAIT = Object.freeze({ pollSeconds: 30, graceMinutes: 10, waitMinutes: 90 });

/** An app whose gate already ran: the annotated tag on HEAD and its green L4 record in <git common dir>/starci-release. */
function releasedApp(t) {
  const root = fs.mkdtempSync(path.join(tempRoot(), 'hfs-require-ci-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const common = path.join(root, '.git');
  fs.mkdirSync(path.join(common, 'starci-release'), { recursive: true });
  fs.writeFileSync(path.join(common, 'starci-release', `${HEAD}.l4.json`), JSON.stringify({ schema: 'starci-app-l4-record/1', head: HEAD, tag: TAG, gates: [{ name: 'test', pass: true }] }));
  return { root, common };
}

/** The git and gh seam of a push to an empty remote: every call is recorded; the candidate CI run of HEAD is green. */
function seam(common) {
  const calls = [];
  const spawn = (command, args) => {
    calls.push([command, ...args]);
    if (command === 'gh' && args[1] === 'list') return { status: 0, stdout: JSON.stringify([{ databaseId: 7, headSha: HEAD, status: 'completed', conclusion: 'success', url: 'https://example.invalid/runs/7', event: 'push', createdAt: '2026-10-21T00:00:00Z' }]) };
    if (command !== 'git') throw new Error(`unexpected ${command} ${args.join(' ')}`);
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return { status: 0, stdout: HEAD };
    if (args[0] === 'rev-parse' && args[1] === '--git-common-dir') return { status: 0, stdout: common };
    if (args[0] === 'tag') return { status: 0, stdout: TAG };
    if (args[0] === 'cat-file') return { status: 0, stdout: 'tag' };
    if (args[0] === 'ls-remote') return { status: 0, stdout: '' };
    if (args[0] === 'push') return { status: 0, stdout: '', stderr: 'Everything up-to-date' };
    throw new Error(`unexpected git ${args.join(' ')}`);
  };
  let clock = 0;
  return { calls, ctx: { spawn, now: () => clock, sleep: async (ms) => { clock += ms; } } };
}

const config = (requireCi) => normalizeRelease(requireCi === undefined ? {} : { requireCi }).config;

test('release.requireCi defaults to false, accepts true and false and refuses any other value', () => {
  assert.equal(config(undefined).requireCi, false);
  assert.equal(config(true).requireCi, true);
  assert.equal(config(false).requireCi, false);
  assert.deepEqual(normalizeRelease({ requireCi: 'yes' }).problems, ['release.requireCi: must be true or false']);
});

test('requireCi false pushes after the dry run with no candidate CI and says CI was not required', async (t) => {
  const { root, common } = releasedApp(t);
  const { calls, ctx } = seam(common);
  const result = await releasePush({ ...ctx, cwd: root }, config(undefined), { execute: true });
  assert.equal(result.ok, true, result.lines.join(' | '));
  assert.equal(result.data.pushed, true);
  assert.deepEqual(result.data.candidate, { required: false, note: CI_NOT_REQUIRED });
  assert.ok(result.lines.some((line) => line.includes(CI_NOT_REQUIRED)), 'the push output says CI was not required');
  const pushes = calls.filter((call) => call[0] === 'git' && call[1] === 'push').map((call) => call.slice(2).join(' '));
  assert.deepEqual(pushes, [`--dry-run --atomic origin ${HEAD}:refs/heads/main refs/tags/${TAG}`, `--atomic origin ${HEAD}:refs/heads/main refs/tags/${TAG}`]);
  assert.equal(calls.some((call) => call[0] === 'gh'), false, 'GitHub is never read');
});

test('requireCi false still refuses without the annotated tag and the green L4 record', async (t) => {
  const { root, common } = releasedApp(t);
  fs.rmSync(path.join(common, 'starci-release', `${HEAD}.l4.json`));
  const { calls, ctx } = seam(common);
  const result = await releasePush({ ...ctx, cwd: root }, config(false), { execute: true });
  assert.equal(result.ok, false);
  assert.ok(result.lines.some((line) => line.includes('no L4 record')));
  assert.equal(calls.some((call) => call[1] === 'push'), false, 'nothing is pushed');
});

test('requireCi true pushes the candidate ref first and waits for its green CI before the atomic push', async (t) => {
  const { root, common } = releasedApp(t);
  const { calls, ctx } = seam(common);
  const result = await releasePush({ ...ctx, cwd: root }, config(true), { execute: true, candidateWait: WAIT });
  assert.equal(result.ok, true, result.lines.join(' | '));
  const pushes = calls.filter((call) => call[0] === 'git' && call[1] === 'push').map((call) => call.slice(2).join(' '));
  assert.deepEqual(pushes, [`--dry-run --atomic origin ${HEAD}:refs/heads/main refs/tags/${TAG}`, `origin +${HEAD}:refs/heads/release/candidate-1.2.3`, `--atomic origin ${HEAD}:refs/heads/main refs/tags/${TAG}`]);
  assert.equal(result.data.candidate.state, 'green');
  assert.equal(result.lines.some((line) => line.includes(CI_NOT_REQUIRED)), false);
});
