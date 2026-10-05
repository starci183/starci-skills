import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main as runtimeMain } from '../../scripts/cli/main.mjs';
import { starciShimPath, stopEngine, taskScript } from '../../scripts/reconciler/boot.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

test('reconciler catalog resolves controls and the full up checklist', t => {
  const runtimeRoot = mkdtemp(t, 'starci-reconciler-cli-');
  fs.copyFileSync(path.resolve(import.meta.dirname, '../../config.example.yaml'), path.join(runtimeRoot, 'config.example.yaml'));
  const calls = [];
  const runScript = (script, args) => { calls.push({ script, args }); return 0; };
  for (const argv of [
    ['reconciler', 'start', '--json'],
    ['reconciler', 'stop'],
    ['reconciler', 'restart'],
    ['reconciler', 'status', '--json'],
    ['reconciler', 'up', '--check', '--wait', '5', '--no-build'],
  ]) assert.equal(runtimeMain(argv, { catalog, runScript, runtimeRoot, env: {} }), 0, argv.join(' '));
  assert.deepEqual(calls.map((call) => call.args), [
    ['ensure', '--json'], ['--stop'], ['--restart'], ['--status', '--json'], ['--check', '--wait', '5', '--no-build'],
  ]);
  assert.match(calls[0].script, /scripts[\\/]reconciler[\\/]boot\.mjs$/);
  assert.match(calls.at(-1).script, /scripts[\\/]reconciler[\\/]start\.mjs$/);
});

test('reconciler task registration launches the resolved starci shim', () => {
  const starci = path.join(os.tmpdir(), '.starci', 'bin', 'starci.cmd');
  const workdir = path.join(os.tmpdir(), 'runtime');
  const script = taskScript({ starci, workdir, every: 7 });
  assert.match(script, /reconciler start/);
  assert.match(script, /RepetitionInterval \(New-TimeSpan -Minutes 7\)/);
  assert.ok(script.includes(starci));
  assert.doesNotMatch(script, /scripts[\\/]reconciler[\\/]boot\.mjs/);
  assert.match(starciShimPath({ home: '/home/test', platform: 'linux' }), /[\\/]\.starci[\\/]bin[\\/]starci$/);
});

test('reconciler stop acts only on the leader and lock PIDs and settles successful stops', () => {
  const calls = [];
  const recorded = [];
  const machine = {
    transaction: (fn) => fn(),
    openProcessRuns: () => [{ run_id: 9, pid: 41 }],
    endProcessRun: (...args) => recorded.push(['run', ...args]),
    leaderOf: () => ({ pid: 41, epoch: 3 }),
    releaseLeader: (...args) => recorded.push(['leader', ...args]),
  };
  const result = stopEngine({ leader: () => ({ pid: 41 }), lock: () => ({ pid: 41 }), alive: () => true,
    stop: (pid) => { calls.push(pid); return { ok: true }; }, record: (fn) => fn(machine) });
  assert.deepEqual(calls, [41]);
  assert.equal(result.action, 'stopped');
  assert.deepEqual(recorded.map((entry) => entry[0]), ['run', 'leader']);
});
