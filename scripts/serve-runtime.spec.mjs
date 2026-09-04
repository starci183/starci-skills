// The helper that starts a detached server, and the three things that make it safe: the command comes
// from the route declaration rather than from an argument somebody remembered, a stop kills the pid
// the record names and nothing else, and the build cache is cleared whenever the dependency
// manifests moved since the previously served record — or when there is no such record to compare.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  commandFor, pidFileOf, previousFileOf, readRecord, stop, start, portTaken, recordListener,
  manifestPaths, manifestDigest, buildCacheDirs, cacheDecision, clearBuildCache, parseArgs,
  reusable } from './serve-runtime.mjs';

test('the route declaration publishes the dev command, and the convention is the last resort', () => {
  assert.equal(commandFor({ routeConfig: { dev: 'pnpm dev --port 3067' }, command: 'npm start', port: 3067 }), 'pnpm dev --port 3067');
  assert.equal(commandFor({ routeConfig: null, command: 'npm start', port: 3067 }), 'npm start');
  assert.equal(commandFor({ routeConfig: {}, command: null, port: 3067 }), 'npm run dev -- --port 3067');
});

test('the pid file and the previous record live beside the log, so a stop never has to guess', () => {
  assert.equal(pidFileOf('/a/b/uat.log'), '/a/b/uat.pid');
  assert.equal(previousFileOf('/a/b/uat.log'), '/a/b/uat.previous.json');
});

test('a stop on a record that does not exist reports it instead of killing something else', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'serve-runtime-'));
  const result = await stop(path.join(dir, 'missing.pid'));
  assert.equal(result.stopped, false);
  assert.match(result.reason, /no pid file/);
  rmSync(dir, { recursive: true, force: true });
});

test('a recorded process that is already gone is reported, its pid file cleared and its record kept as the previous one', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'serve-runtime-'));
  const pidFile = path.join(dir, 'uat.pid');
  // A pid this high is not a live process on any machine this runs on; the point is that the script
  // reports what it found rather than killing whatever now wears that number.
  writeFileSync(pidFile, JSON.stringify({ pid: 4194303, port: 3067, head: 'a'.repeat(40), manifestDigest: 'sha256:x' }));
  const result = await stop(pidFile, { probe: async () => false, settle: 0 });
  assert.equal(result.stopped, false);
  assert.equal(existsSync(pidFile), false);
  const previous = readRecord(previousFileOf(path.join(dir, 'uat.log')));
  assert.equal(previous.head, 'a'.repeat(40));
  assert.equal(previous.manifestDigest, 'sha256:x');
  rmSync(dir, { recursive: true, force: true });
});

// The recorded pid is a wrapper and the listener is its child, so a stop takes the tree and then
// asks the port itself before the record goes.
const stopScene = (record) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'serve-runtime-'));
  const pidFile = path.join(dir, 'uat.pid');
  writeFileSync(pidFile, JSON.stringify({ pid: 4100, listenerPid: 4150, port: 3067, head: 'a'.repeat(40), manifestDigest: 'sha256:x', ...record }));
  return { dir, pidFile };
};

test('a stop takes the whole tree of the recorded pid, proves the port free, and only then clears the record', async () => {
  const { dir, pidFile } = stopScene();
  const killed = [];
  let alivePids = new Set([4100, 4150]);
  const result = await stop(pidFile, {
    isAlive: (pid) => alivePids.has(pid),
    kill: (pid) => { killed.push(pid); alivePids = new Set(); return true; },
    probe: async () => alivePids.size > 0,
    listener: () => null,
    settle: 0,
  });
  assert.deepEqual(result, { stopped: true, pid: 4100, listenerPid: 4150, port: 3067 });
  assert.deepEqual(killed, [4100]);
  assert.equal(existsSync(pidFile), false);
  assert.equal(readRecord(previousFileOf(path.join(dir, 'uat.log'))).pid, 4100);
  rmSync(dir, { recursive: true, force: true });
});

test('a stop whose port still answers keeps the pid file and names the surviving listener found by port', async () => {
  const { dir, pidFile } = stopScene();
  const alivePids = new Set([4100]);
  const result = await stop(pidFile, {
    isAlive: (pid) => alivePids.has(pid),
    kill: (pid) => { alivePids.delete(pid); return true; },
    probe: async () => true,
    listener: (port) => (port === 3067 ? 52564 : null),
    settle: 0,
  });
  assert.equal(result.stopped, false);
  assert.equal(result.listenerPid, 52564);
  assert.match(result.reason, /port 3067 still answers/);
  assert.match(result.reason, /pid 52564 holds the listener/);
  assert.equal(existsSync(pidFile), true, 'the record stays until the port is free');
  rmSync(dir, { recursive: true, force: true });
});

test('a record whose wrapper is gone but whose port is still held is refused the same way, so the next start cannot mistake it for free', async () => {
  const { dir, pidFile } = stopScene({ listenerPid: null });
  const result = await stop(pidFile, { isAlive: () => false, kill: () => { throw new Error('nothing should be signalled'); }, probe: async () => true, listener: () => 777, settle: 0 });
  assert.equal(result.stopped, false);
  assert.equal(result.listenerPid, 777);
  assert.equal(existsSync(pidFile), true);
  rmSync(dir, { recursive: true, force: true });
});

test('the listener pid is recorded beside the wrapper pid only when the two differ', async () => {
  const { dir, pidFile } = stopScene({ listenerPid: null });
  const same = await recordListener(pidFile, { wait: 0, probe: async () => true, listener: () => 4100 });
  assert.equal(same.listenerPid, null);
  assert.equal(same.answered, true);
  const child = await recordListener(pidFile, { wait: 0, probe: async () => true, listener: () => 52564 });
  assert.equal(child.listenerPid, 52564);
  assert.equal(readRecord(pidFile).listenerPid, 52564);
  const silent = await recordListener(pidFile, { wait: 0, probe: async () => false, listener: () => { throw new Error('never asked when nothing answers'); } });
  assert.equal(silent.answered, false);
  rmSync(dir, { recursive: true, force: true });
});

test('a port nothing answers on is free', async () => {
  assert.equal(await portTaken(1, '127.0.0.1', 100), false);
});

test('a start on a worktree that is not there says so and starts nothing', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'serve-runtime-'));
  await assert.rejects(() => start({ worktree: path.join(dir, 'nope'), port: 3067, log: path.join(dir, 'uat.log') }), /no worktree at/);
  assert.equal(readRecord(path.join(dir, 'uat.pid')), null);
  rmSync(dir, { recursive: true, force: true });
});

test('--clean is an argument, and it is the only way to ask for a cleared cache by name', () => {
  assert.equal(parseArgs(['/wt', '3067', '--log', '/l/uat.log']).clean, false);
  assert.equal(parseArgs(['/wt', '3067', '--log', '/l/uat.log', '--clean']).clean, true);
});

test('the digested manifests are the ones the route declares plus the lockfiles beside each and at the root', () => {
  const paths = manifestPaths({ context: { manifests: ['apps/app/package.json'] } });
  assert.ok(paths.includes('apps/app/package.json'));
  assert.ok(paths.includes('apps/app/pnpm-lock.yaml'));
  assert.ok(paths.includes('package-lock.json'));
  assert.ok(paths.includes('pnpm-lock.yaml'));
  // A route that declares nothing still digests the root lockfiles: an install moves there too.
  assert.ok(manifestPaths(null).includes('yarn.lock'));
});

test('a lockfile that moved changes the digest, and one that did not keeps it', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'serve-runtime-'));
  writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}');
  writeFileSync(path.join(dir, 'package-lock.json'), '{"lockfileVersion":3,"packages":{"a":{"version":"0.4.7"}}}');
  const route = { context: { manifests: ['package.json'] } };
  const before = manifestDigest(dir, route);
  assert.deepEqual(before.files, ['package-lock.json', 'package.json']);
  assert.equal(manifestDigest(dir, route).digest, before.digest);
  writeFileSync(path.join(dir, 'package-lock.json'), '{"lockfileVersion":3,"packages":{"a":{"version":"0.4.8"}}}');
  assert.notEqual(manifestDigest(dir, route).digest, before.digest);
  rmSync(dir, { recursive: true, force: true });
});

test('the cache is cleared when asked, when nothing previous is known, and when the manifests moved; otherwise it is kept', () => {
  const previous = { head: 'a'.repeat(40), manifestDigest: 'sha256:same' };
  assert.deepEqual(cacheDecision({ clean: true, previous, digest: 'sha256:same' }), { clear: true, reason: 'asked' });
  assert.deepEqual(cacheDecision({ previous: null, digest: 'sha256:same' }), { clear: true, reason: 'previous-unknown' });
  assert.deepEqual(cacheDecision({ previous: { head: 'a'.repeat(40) }, digest: 'sha256:same' }), { clear: true, reason: 'previous-unknown' });
  assert.deepEqual(cacheDecision({ previous, digest: 'sha256:other' }), { clear: true, reason: 'manifests-changed' });
  assert.deepEqual(cacheDecision({ previous, digest: 'sha256:same' }), { clear: false, reason: 'unchanged' });
});

test('the conventional build caches are found at every package directory within reach and never inside node_modules, and clearing removes exactly them', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'serve-runtime-'));
  for (const rel of ['apps/app/.next/dev', 'apps/app/src', 'node_modules/.cache', 'node_modules/dep/.next', 'packages/ui/node_modules/.vite', '.turbo']) mkdirSync(path.join(dir, rel), { recursive: true });
  writeFileSync(path.join(dir, 'apps/app/src/page.tsx'), '');
  assert.deepEqual(buildCacheDirs(dir), ['.turbo', 'apps/app/.next', 'node_modules/.cache', 'packages/ui/node_modules/.vite']);
  const cleared = clearBuildCache(dir);
  assert.deepEqual(cleared, ['.turbo', 'apps/app/.next', 'node_modules/.cache', 'packages/ui/node_modules/.vite']);
  assert.equal(existsSync(path.join(dir, 'apps/app/.next')), false);
  assert.equal(existsSync(path.join(dir, 'apps/app/src/page.tsx')), true);
  assert.equal(existsSync(path.join(dir, 'node_modules/dep/.next')), true);
  rmSync(dir, { recursive: true, force: true });
});

test('a live server is reused only while it serves this head with these manifests; a moved worktree is not reused', () => {
  const record = { pid: 1, head: 'a'.repeat(40), manifestDigest: 'sha256:m' };
  assert.equal(reusable(record, 'a'.repeat(40), 'sha256:m'), true);
  assert.equal(reusable(record, 'b'.repeat(40), 'sha256:m'), false, 'the head moved');
  assert.equal(reusable(record, 'a'.repeat(40), 'sha256:n'), false, 'the manifests changed');
  assert.equal(reusable({ pid: 1 }, 'a'.repeat(40), 'sha256:m'), false, 'a record with no head is never reused');
  assert.equal(reusable(null, 'a'.repeat(40), 'sha256:m'), false);
});
