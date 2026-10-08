// land-detach.spec.mjs — the land outlives the command that typed it (registry entry supervisor-killed-its-own-land): a land typed
// without --foreground runs in a detached child of its own session and the verb answers at once; the Supervisor seat cannot land at
// all (RUNTIME_CHANGE_OWNED_BY_DEBUG), so the one path left to a land is a caller with a command window shorter than the gate.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { foregroundArgv, startDetachedLand, detachedLandLine } from '../../scripts/supervisor/land-detach.mjs';
import { loadCommandPolicy, policyVerdict } from '../../scripts/guards/command-policy.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const made = [];
const scratch = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-land-detach-')); made.push(dir); return dir; };
after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });

test('the child runs the land in the foreground with the answer as JSON, whatever the caller typed', () => {
  assert.deepEqual(foregroundArgv(['--commit', 'abc', '--json', '--lane', 'x']), ['--foreground', '--json', '--commit', 'abc', '--lane', 'x']);
  assert.deepEqual(foregroundArgv(['--foreground', '--commit', 'abc']), ['--foreground', '--json', '--commit', 'abc']);
});

test('the land starts detached with its answer and log under the lanes root, and the caller is not waiting for it', () => {
  const lanes = scratch();
  const calls = [];
  const fake = (args, options) => { calls.push({ args, options }); return { pid: 4242, unref: () => calls.push('unref') }; };
  const started = startDetachedLand({ script: 'land.mjs', argv: ['--commit', 'abc'], env: { STARCI_LANES_ROOT: lanes }, spawn: fake });
  assert.equal(started.pid, 4242);
  assert.equal(path.dirname(started.resultFile), path.join(lanes, 'land-runs'));
  assert.ok(fs.existsSync(started.resultFile) && fs.existsSync(started.logFile));
  assert.deepEqual(calls[0].args, ['land.mjs', '--foreground', '--json', '--commit', 'abc']);
  assert.equal(calls[0].options.detached, true, 'its own session: the caller timeout or interrupt does not reach it');
  assert.equal(calls[0].options.stdio[0], 'ignore');
  assert.ok(calls.includes('unref'), 'the caller does not wait for the child');
  assert.match(detachedLandLine(started), /outlives this command/);
});

test('a real child keeps running and writes its answer after the starter returned', async () => {
  const lanes = scratch();
  const script = path.join(lanes, 'slow-land.mjs');
  fs.writeFileSync(script, "await new Promise((r) => setTimeout(r, 700)); console.log(JSON.stringify({ ok: true, argv: process.argv.slice(2) }));\n");
  const before = Date.now();
  const started = startDetachedLand({ script, argv: ['--commit', 'abc'], env: { ...process.env, STARCI_LANES_ROOT: lanes } });
  assert.ok(Date.now() - before < 600, 'the starter returned before the child finished');
  const deadline = Date.now() + 15_000;
  let answer = '';
  while (Date.now() < deadline && !answer.trim()) { await new Promise((r) => setTimeout(r, 100)); answer = fs.readFileSync(started.resultFile, 'utf8'); }
  assert.deepEqual(JSON.parse(answer), { ok: true, argv: ['--foreground', '--json', '--commit', 'abc'] });
});

test('the verb without --foreground answers at once and without a commit it still prints its usage', () => {
  const lanes = scratch();
  const env = { ...process.env, STARCI_LANES_ROOT: lanes };
  const usage = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'supervisor', 'land.mjs')], { encoding: 'utf8', env });
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /--foreground/);
  assert.equal(fs.existsSync(path.join(lanes, 'land-runs')), false, 'a bad usage starts nothing');
});

test('the Supervisor seat cannot land, so no process cleanup of its own can kill a land it started', () => {
  const policy = loadCommandPolicy({ root: ROOT });
  for (const args of [['supervisor', 'land', '--commit', 'abc'], ['supervisor', 'land', '--commit', 'abc', '--foreground']]) {
    const verdict = policyVerdict({ role: 'supervisor', command: { program: 'starci', args }, policy });
    assert.equal(verdict.code, 'RUNTIME_CHANGE_OWNED_BY_DEBUG', args.join(' '));
  }
});
