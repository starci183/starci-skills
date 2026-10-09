import assert from 'node:assert/strict';

import os from 'node:os';
import path from 'node:path';
import test from 'node:test';


import { starciShimPath, stopEngine, taskScript } from '../../scripts/reconciler/boot.mjs';




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
