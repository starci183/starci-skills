// The helper that starts a detached server, and the two things that make it safe: the command comes
// from the route declaration rather than from an argument somebody remembered, and a stop kills the
// pid the record names and nothing else.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { commandFor, pidFileOf, readRecord, stop, start, portTaken } from './serve-runtime.mjs';

test('the route declaration publishes the dev command, and the convention is the last resort', () => {
  assert.equal(commandFor({ routeConfig: { dev: 'pnpm dev --port 3067' }, command: 'npm start', port: 3067 }), 'pnpm dev --port 3067');
  assert.equal(commandFor({ routeConfig: null, command: 'npm start', port: 3067 }), 'npm start');
  assert.equal(commandFor({ routeConfig: {}, command: null, port: 3067 }), 'npm run dev -- --port 3067');
});

test('the pid file lives beside the log, so a stop never has to guess', () => {
  assert.equal(pidFileOf('/a/b/uat.log'), '/a/b/uat.pid');
});

test('a stop on a record that does not exist reports it instead of killing something else', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'serve-runtime-'));
  const result = stop(path.join(dir, 'missing.pid'));
  assert.equal(result.stopped, false);
  assert.match(result.reason, /no pid file/);
  rmSync(dir, { recursive: true, force: true });
});

test('a recorded process that is already gone is reported, and its record cleared', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'serve-runtime-'));
  const pidFile = path.join(dir, 'uat.pid');
  // A pid this high is not a live process on any machine this runs on; the point is that the script
  // reports what it found rather than killing whatever now wears that number.
  writeFileSync(pidFile, JSON.stringify({ pid: 4194303, port: 3067 }));
  const result = stop(pidFile);
  assert.equal(result.stopped, false);
  assert.equal(existsSync(pidFile), false);
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
