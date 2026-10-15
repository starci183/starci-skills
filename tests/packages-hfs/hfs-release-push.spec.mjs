import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { releaseGate, releaseDir } from '../../packages/hfs/release/gate.mjs';
import { loadReleaseConfig, releaseMain } from '../../packages/hfs/release/index.mjs';
import { gateState, releasePush } from '../../packages/hfs/release/push.mjs';
import { StackError } from '../../packages/hfs/stack/errors.mjs';
import { gitIn, greenTool, makeRepo, makeSpawn, releaseCtx, sequence } from '../helpers/release-fakes.mjs';

const repos = [];
const dirs = [];
const repoWith = (options) => {
  const repo = makeRepo(options);
  repos.push(repo);
  return repo;
};
after(() => {
  for (const repo of repos) repo.cleanup();
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

const session = (repo) => {
  const spawn = makeSpawn(greenTool());
  return { ...releaseCtx(repo.root, { spawn }), spawn, config: loadReleaseConfig(repo.root) };
};

/** A repository whose release gate ran green, so HEAD has its annotated tag and L4 record. */
async function greenRepo(options = {}) {
  const repo = repoWith(options);
  const { ctx, config } = session(repo);
  const gate = await releaseGate(ctx, config, { execute: true, platform: 'linux' });
  assert.equal(gate.ok, true, gate.lines.join('\n'));
  return { repo, ...session(repo) };
}

/** Another clone of the bare remote, to move the remote behind the repository's back. */
function otherClone(repo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-clone-'));
  dirs.push(dir);
  gitIn(dir, ['clone', '--quiet', repo.remote, '.']);
  for (const [key, value] of [['user.name', 'Other'], ['user.email', 'other@example.com'], ['commit.gpgsign', 'false'], ['tag.gpgsign', 'false']]) gitIn(dir, ['config', key, value]);
  return dir;
}

const remoteRefs = (repo) => repo.remoteGit('for-each-ref', '--format=%(refname)');
const refused = (promise, code) => assert.rejects(promise, (error) => error instanceof StackError && error.code === code);
const reds = (result) => result.lines.filter((line) => line.startsWith('RED: '));

test('a green gate, a dry run through the canon hook, then the atomic push, then nothing to do', async () => {
  const { repo, ctx, config } = await greenRepo();
  const head = repo.head();
  const dry = await releasePush(ctx, config, {});
  assert.equal(dry.ok, true, dry.lines.join('\n'));
  assert.deepEqual(dry.data.refs, [`${head}:refs/heads/main`, 'refs/tags/v1.0.0']);
  assert.equal(dry.data.hook.exit, 0);
  assert.equal(dry.data.pushed, false);
  assert.match(dry.lines.join('\n'), /release gate +OK: annotated v1\.0\.0 on HEAD, L4 record names head and tag/u);
  assert.match(dry.lines.join('\n'), /dry run: nothing pushed\. ready; re-run with --execute\./u);
  assert.equal(remoteRefs(repo), '');
  const pushed = await releasePush(ctx, config, { execute: true });
  assert.equal(pushed.ok, true, pushed.lines.join('\n'));
  assert.equal(pushed.data.pushed, true);
  assert.equal(repo.remoteGit('rev-parse', 'refs/heads/main'), head);
  assert.equal(repo.remoteGit('cat-file', '-t', 'refs/tags/v1.0.0'), 'tag');
  const again = await releasePush(ctx, config, { execute: true });
  assert.equal(again.ok, true);
  assert.match(again.lines.join('\n'), /Nothing to do\./u);
  assert.deepEqual(again.data.refs, []);
});

test('the push never skips the hook: no --no-verify in any git call', async () => {
  const { repo, ctx, spawn, config } = await greenRepo();
  await releasePush(ctx, config, { execute: true });
  const pushes = spawn.calls.filter((call) => call.command === 'git' && call.args[0] === 'push');
  assert.equal(pushes.length, 2);
  assert.deepEqual(pushes[0].args.slice(0, 3), ['push', '--dry-run', '--atomic']);
  assert.deepEqual(pushes[1].args.slice(0, 2), ['push', '--atomic']);
  for (const call of spawn.calls) assert.equal(call.args.includes('--no-verify'), false);
  assert.ok(repo.remoteGit('rev-parse', 'refs/heads/main'));
});

test('without the annotated tag and the L4 record of HEAD the gate is closed', async () => {
  const bare = repoWith({});
  const none = session(bare);
  const noTag = await releasePush(none.ctx, none.config, {});
  assert.equal(noTag.ok, false);
  assert.match(reds(noTag)[0], /no ANNOTATED tag v\[0-9\]\* on HEAD: run starci app release gate --execute first/u);
  assert.match(noTag.lines.join('\n'), /CLOSED/u);
  assert.equal(noTag.data.tag, null);

  const light = repoWith({});
  light.git('tag', 'v1.0.0');
  const lightweight = session(light);
  assert.match(reds(await releasePush(lightweight.ctx, lightweight.config, {}))[0], /no ANNOTATED tag/u);

  const noRecord = repoWith({});
  noRecord.git('tag', '-a', 'v1.0.0', '-m', 'x');
  const missing = session(noRecord);
  assert.match(reds(await releasePush(missing.ctx, missing.config, {}))[0], /no L4 record/u);
  assert.equal(remoteRefs(noRecord), '');
});

test('a record that does not name head and tag with every gate green closes the gate', async () => {
  const { repo, ctx, config } = await greenRepo();
  const file = path.join(releaseDir(ctx), `${repo.head()}.l4.json`);
  const good = JSON.parse(fs.readFileSync(file, 'utf8'));
  const variants = {
    'other head': { ...good, head: 'f'.repeat(40) },
    'other tag': { ...good, tag: 'v9.9.9' },
    'a red gate': { ...good, gates: [{ ...good.gates[0], pass: false }] },
    'no gates': { ...good, gates: [] },
    'gates not a list': { ...good, gates: 'all' },
  };
  await sequence(Object.entries(variants), async ([name, record]) => {
    fs.writeFileSync(file, JSON.stringify(record));
    const result = await releasePush(ctx, config, { execute: true });
    assert.equal(result.ok, false, name);
    assert.match(reds(result)[0], /the L4 record does not name head .* with every gate green/u, name);
  });
  await sequence(['{ not json', 'null'], async (text) => {
    fs.writeFileSync(file, text);
    assert.equal((await releasePush(ctx, config, {})).ok, false, text);
  });
  assert.equal(remoteRefs(repo), '');
  assert.equal(gateState(ctx, 'f'.repeat(40), 'v').reason.includes('no L4 record'), true);
});

test('a hook that rejects the dry run refuses the push and nothing reaches the remote', async () => {
  const { repo, ctx, config } = await greenRepo({ hook: 'reject' });
  const dry = await releasePush(ctx, config, {});
  assert.equal(dry.ok, false);
  assert.equal(dry.data.hook.exit, 1);
  assert.match(dry.lines.join('\n'), /RIGHTS_PUSH_NOT_RELEASE/u);
  assert.match(reds(dry)[0], /the pre-push hook refuses this push/u);
  assert.match(dry.lines.join('\n'), /dry run: nothing pushed\./u);
  const executed = await releasePush(ctx, config, { execute: true });
  assert.equal(executed.ok, false);
  assert.equal(executed.lines.at(-1), 'nothing pushed.');
  assert.equal(remoteRefs(repo), '');
});

test('the real hook is the proof: removing the record behind its back makes it refuse', async () => {
  const { repo, ctx, config } = await greenRepo();
  const first = await releasePush(ctx, config, {});
  assert.equal(first.data.hook.exit, 0);
  fs.rmSync(path.join(releaseDir(ctx), `${repo.head()}.l4.json`));
  const probe = repo.git('tag', '--list');
  assert.equal(probe, 'v1.0.0');
  assert.throws(() => repo.git('push', '--dry-run', '--atomic', 'origin', 'refs/tags/v1.0.0'), /RIGHTS_PUSH_NOT_RELEASE/u);
});

test('a real push that the remote itself rejects is reported and nothing is claimed', async () => {
  const { repo, ctx, config } = await greenRepo({ remoteHook: '#!/bin/sh\necho "remote says no" >&2\nexit 1\n' });
  const dry = await releasePush(ctx, config, {});
  assert.equal(dry.ok, true);
  const executed = await releasePush(ctx, config, { execute: true });
  assert.equal(executed.ok, false);
  assert.equal(executed.data.pushed, false);
  assert.match(executed.lines.at(-1), /^push failed: /u);
  assert.equal(remoteRefs(repo), '');
});

test('a remote branch that is not an ancestor of HEAD is not a fast-forward', async () => {
  const repo = repoWith({ hook: 'none' });
  repo.git('push', '--quiet', 'origin', 'HEAD:refs/heads/main');
  const clone = otherClone(repo);
  fs.writeFileSync(path.join(clone, 'theirs.txt'), 'x');
  gitIn(clone, ['add', '-A']);
  gitIn(clone, ['commit', '--quiet', '-m', 'theirs']);
  gitIn(clone, ['push', '--quiet', 'origin', 'HEAD:refs/heads/main']);
  repo.commit('mine.txt');
  const green = session(repo);
  await releaseGate(green.ctx, green.config, { execute: true, platform: 'linux' });
  const { ctx, config } = green;
  const result = await releasePush(ctx, config, { execute: true });
  assert.equal(result.ok, false);
  assert.match(reds(result)[0], /not an ancestor of HEAD: not a fast-forward; merge it first/u);
  assert.equal(repo.remoteGit('log', '-1', '--format=%s', 'refs/heads/main'), 'theirs');
});

test('a remote branch that already holds HEAD needs only the tag; one that is ahead needs only the tag too', async () => {
  const { repo, ctx, config } = await greenRepo({ hook: 'none' });
  repo.git('push', '--quiet', 'origin', 'HEAD:refs/heads/main');
  const tagOnly = await releasePush(ctx, config, {});
  assert.deepEqual(tagOnly.data.refs, ['refs/tags/v1.0.0']);
  const clone = otherClone(repo);
  fs.writeFileSync(path.join(clone, 'ahead.txt'), 'x');
  gitIn(clone, ['add', '-A']);
  gitIn(clone, ['commit', '--quiet', '-m', 'ahead']);
  gitIn(clone, ['push', '--quiet', 'origin', 'HEAD:refs/heads/main']);
  const ahead = await releasePush(ctx, config, { execute: true });
  assert.equal(ahead.ok, true, ahead.lines.join('\n'));
  assert.deepEqual(ahead.data.refs, ['refs/tags/v1.0.0']);
  assert.equal(repo.remoteGit('log', '-1', '--format=%s', 'refs/heads/main'), 'ahead');
  assert.equal(repo.remoteGit('cat-file', '-t', 'refs/tags/v1.0.0'), 'tag');
});

test('a tag that exists on the remote as another object is red', async () => {
  const { repo, ctx, config } = await greenRepo({ hook: 'none' });
  repo.git('push', '--quiet', 'origin', 'HEAD:refs/heads/main');
  const clone = otherClone(repo);
  gitIn(clone, ['tag', '-a', 'v1.0.0', '-m', 'someone else']);
  gitIn(clone, ['push', '--quiet', 'origin', 'refs/tags/v1.0.0']);
  const result = await releasePush(ctx, config, {});
  assert.equal(result.ok, false);
  assert.match(reds(result)[0], /tag v1\.0\.0 exists on origin as a different object/u);
});

test('an unreachable remote cannot be judged', async () => {
  const { repo, ctx, config } = await greenRepo();
  repo.git('remote', 'set-url', 'origin', path.join(os.tmpdir(), 'release-no-such-remote'));
  await assert.rejects(releasePush(ctx, config, {}), (error) => error.code === 'RELEASE_REMOTE_UNREACHABLE' && error.exit === 1);
});

test('remote and branch names are validated and the declared default branch is used', async () => {
  const { repo, ctx, config } = await greenRepo({ hook: 'none', release: { defaultBranch: 'trunk' } });
  await refused(releasePush(ctx, config, { remote: '-x' }), 'RELEASE_USAGE');
  await refused(releasePush(ctx, config, { remote: 'bad name' }), 'RELEASE_USAGE');
  await refused(releasePush(ctx, { ...config, defaultBranch: '--force' }, {}), 'RELEASE_USAGE');
  const result = await releasePush(ctx, config, { execute: true, remote: 'origin' });
  assert.equal(result.ok, true, result.lines.join('\n'));
  assert.equal(repo.remoteGit('rev-parse', 'refs/heads/trunk'), repo.head());
  assert.match(result.lines.at(-1), /^pushed to origin: .*:refs\/heads\/trunk/u);
});

test('releaseMain push prints JSON without any secret-looking field', async () => {
  const { repo } = await greenRepo();
  const spawn = makeSpawn({});
  const out = [];
  const code = await releaseMain(['push', '--json'], { cwd: repo.root, stdout: (text) => out.push(text), stderr: () => {}, env: { SECRET_TOKEN: 'do-not-print' }, stackIo: { spawn } });
  assert.equal(code, 0);
  const json = JSON.parse(out.join(''));
  assert.equal(json.verb, 'push');
  assert.equal(json.tag, 'v1.0.0');
  assert.equal(out.join('').includes('do-not-print'), false);
});
