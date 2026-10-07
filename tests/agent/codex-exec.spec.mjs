// scripts/api/codex: the one-shot `codex exec` runner (a stand-in node script plays the CLI) and the reader of its JSON events.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec } from '../../scripts/api/codex/exec.mjs';
import { codexLauncher } from '../../scripts/api/codex/lib.mjs';
import { failureClass, newExecEvents, takeExecLine } from '../../scripts/lib/codex-exec-events.mjs';

function stand(t, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-codex-exec-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }));
  const file = path.join(dir, 'codex-stand-in.mjs');
  fs.writeFileSync(file, body);
  return file;
}

const ECHO = `
let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  console.log(JSON.stringify({ type: 'thread.started', thread_id: 't-1' }));
  console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: input.trim() } }));
  process.stdout.write(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 5, output_tokens: 1 } }));
  console.error('warned');
  process.exit(Number(process.argv[2] ?? 0));
});
`;

test('exec feeds the prompt on stdin, hands each stdout line to onLine and resolves with the pid and exit', async (t) => {
  const events = newExecEvents();
  const spawned = [];
  const run = await exec(['0'], { input: 'a brief', command: process.execPath, prefix: [stand(t, ECHO)], env: process.env, timeoutMs: 20000,
    onLine: (line) => takeExecLine(events, line), onSpawn: (pid) => spawned.push(pid) });
  assert.deepEqual([run.code, run.signal, run.timedOut, run.exited, run.error], [0, null, false, true, null]);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0], run.pid);
  assert.match(run.stderr, /warned/);
  assert.deepEqual([events.threadId, events.lastMessage, events.usage], ['t-1', 'a brief', { input_tokens: 5, output_tokens: 1 }]);
});

test('a non-zero exit is reported, not thrown', async (t) => {
  const run = await exec(['3'], { input: 'x', command: process.execPath, prefix: [stand(t, ECHO)], env: process.env, timeoutMs: 20000 });
  assert.deepEqual([run.code, run.exited, run.timedOut], [3, true, false]);
});

test('a run past its deadline is stopped through stop(pid) and reported timed out', async (t) => {
  const stopped = [];
  const run = await exec([], { command: process.execPath, prefix: [stand(t, 'setInterval(() => {}, 1000);')], env: process.env, timeoutMs: 300,
    stop: (pid) => { stopped.push(pid); process.kill(pid); } });
  assert.deepEqual([run.timedOut, run.exited], [true, true]);
  assert.deepEqual(stopped, [run.pid]);
});

test('a child that survives its stop resolves with exited false after the grace period', async (t) => {
  const run = await exec([], { command: process.execPath, prefix: [stand(t, 'setInterval(() => {}, 1000);')], env: process.env, timeoutMs: 200, graceMs: 200,
    stop: () => {} });
  t.after(() => { try { process.kill(run.pid); } catch { /* already gone */ } });
  assert.deepEqual([run.timedOut, run.exited, run.code], [true, false, null]);
});

test('a program that cannot start resolves with its error and no pid', async () => {
  const run = await exec([], { command: 'starci-no-such-codex', env: process.env, timeoutMs: 5000 });
  assert.equal(run.pid, null);
  assert.match(run.error, /ENOENT/);
  assert.equal(run.exited, true);
});

test('the launcher runs the script behind the npm shim on Windows and plain codex elsewhere', () => {
  assert.deepEqual(codexLauncher({ platform: 'linux', env: {} }), { command: 'codex', prefix: [] });
  const shim = path.join('C:\\npm', 'codex.cmd');
  const script = path.join('C:\\npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  const exists = (file) => [shim, script].includes(file);
  assert.deepEqual(codexLauncher({ platform: 'win32', env: { Path: 'C:\\other;"C:\\npm"' }, exists }), { command: process.execPath, prefix: [script] });
  assert.deepEqual(codexLauncher({ platform: 'win32', env: { Path: 'C:\\other' }, exists }), { command: 'codex', prefix: [] });
});

test('events: failures, thread and usage are read line by line and a failure text is classed', () => {
  const state = newExecEvents();
  for (const line of ['not json', '{"type":"error","message":"You have hit your usage limit"}', '{"type":"turn.failed","error":{"message":"Not logged in"}}', '{"type":"item.completed","item":{"type":"error","message":"hooks warning"}}']) takeExecLine(state, line);
  assert.deepEqual(state.failures, ['You have hit your usage limit', 'Not logged in']);
  assert.deepEqual(['rate limit exceeded', '429 Too Many Requests', 'please sign in', 'stream disconnected'].map(failureClass), ['quota', 'quota', 'auth', 'runner']);
});
