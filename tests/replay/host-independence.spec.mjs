// The replay world takes every host reading from an injected sample (STARCI_HOST_RESOURCES_JSON), so a replay's verdict never depends on the load of the machine it runs on.
// Cause proved here: the dispatch throttle reads free RAM, and dispatch-ready's `allowed` is min(effective cap - running, pool slots, queued-ready); on a loaded host the
// real free RAM fits no op, the effective cap equals the running count (0), the ready list is empty and a replay that reads `results[0]` of it reads nothing.
// Sequence: status under a starved injected host (allowed 0, nothing ready), status under the roomy default (allowed 1), a Kernel ack, a dispatch push and an engine pass,
// then the trap log: no process of the world read os.freemem, os.totalmem, os.cpus, os.loadavg or fs.statfsSync.
// Real: the Kernel verbs, the engine, the throttle. Stubbed: the Orca binary; the host sample is the injected seam of the runtime (scripts/machine/host-resources.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld, ROOMY_HOST } from '../helpers/replay-world.mjs';

const fixture = loadFixture('shape-guard');
const GIB = 1024 ** 3;
const STARVED = { ...ROOMY_HOST, freeRamBytes: 0.5 * GIB, freeRamPct: 0.8, cpuBusy: 0.99 };
const allowedUnder = (world, host) => {
  const status = world.cli('status', ['--workflow', world.wf], { extraEnv: { STARCI_HOST_RESOURCES_JSON: JSON.stringify(host) } }).json;
  return [status.progress.allowedParallel, status.progress.readyJobs];
};

test('the injected host decides dispatch capacity, and no process of a replayed pass reads the real host', (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  assert.deepEqual(allowedUnder(world, STARVED), [0, []], 'a starved host leaves no capacity: the symptom of a loaded machine');
  const [allowed, ready] = allowedUnder(world, ROOMY_HOST);
  assert.deepEqual([allowed, ready.length], [1, 1], 'the roomy sample the world injects gives capacity');
  assert.equal(world.ack(['work.author']).status, 0);
  const push = world.cli('dispatch-ready', ['--workflow', world.wf, '--foreground']);
  assert.equal(push.json.before.allowed, 1, 'a dispatch push on the default world has capacity whatever the machine does');
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1 }).ok, true);
  assert.deepEqual(world.hostReads(), [], 'no replayed process read the real host');
});

test('the trap sees a read of the real host when the injected sample is taken away', (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  world.cli('status', ['--workflow', world.wf], { extraEnv: { STARCI_HOST_RESOURCES_JSON: '' } });
  const reads = world.hostReads().map((entry) => entry.read);
  assert.ok(reads.includes('os.totalmem') || reads.includes('os.freemem'), `the trap logged the memory read: ${JSON.stringify(reads)}`);
});
