// affected-concurrency.spec.mjs - a long affected run samples the host again while it goes: a run that began on a busy host (limit 1) widens when the host frees, and an explicit --concurrency never moves.
import assert from 'node:assert/strict';
import test from 'node:test';
import { liveLimit } from '../../scripts/supervisor/affected-concurrency.mjs';
import { runBounded } from '../../scripts/supervisor/affected-test.mjs';

const GIB = 1024 ** 3;
const host = (cpuBusy) => ({ logicalThreads: 16, cpuBusy, totalRamBytes: 64 * GIB, freeRamBytes: 48 * GIB });

test('the limit is read again after the interval, reports each change, keeps the last one on a failed sample, and an explicit one never moves', () => {
  let clock = 0, busy = 0.99, failing = false;
  const changes = [];
  const deps = { hostSample: () => { if (failing) throw new Error('no sample'); return host(busy); } };
  const limit = liveLimit({ decision: { concurrency: 1, mode: 'auto' }, deps, intervalMs: 1000, now: () => clock, onChange: (next, was) => changes.push([was, next]) });
  assert.equal(limit(), 1);
  busy = 0;
  clock = 999;
  assert.equal(limit(), 1, 'not yet: the interval has not passed');
  clock = 1000;
  assert.equal(limit(), 8, 'the host is free: 16 threads at 2 per file');
  assert.deepEqual(changes, [[1, 8]]);
  failing = true;
  clock = 2500;
  assert.equal(limit(), 8, 'a failed sample keeps the last limit');
  const fixed = liveLimit({ decision: { concurrency: 3, mode: 'explicit' }, deps, intervalMs: 1, now: () => (clock += 10_000) });
  assert.equal(fixed(), 3);
  assert.equal(fixed(), 3);
});

test('the pool follows a limit that changes while it runs: it never exceeds the current limit and widens when it rises', async () => {
  let limit = 1, flying = 0, peak = 0;
  const widened = [];
  const results = await runBounded(Array.from({ length: 8 }, (_, i) => `f${i}`), () => limit, (file) => {
    flying += 1;
    peak = Math.max(peak, flying);
    widened.push(flying);
    return new Promise((resolve) => { setTimeout(() => { flying -= 1; if (file === 'f0') limit = 4; resolve({ file }); }, 15); });
  });
  assert.deepEqual(results.map((r) => r.file), ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'], 'the results keep the order of the files');
  assert.equal(widened[0], 1);
  assert.ok(peak > 1 && peak <= 4, `peak ${peak}`);
});

test('a number limit and an empty list still work', async () => {
  assert.deepEqual(await runBounded([], 3, () => assert.fail('nothing to run')), []);
  assert.deepEqual((await runBounded(['a', 'b', 'c'], 2, async (file) => file.toUpperCase())), ['A', 'B', 'C']);
});
