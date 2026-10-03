import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTestConcurrency } from '../../scripts/machine/test-concurrency.mjs';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';
import { validateArgs } from '../../packages/cli/src/validate-args.mjs';

const host = (overrides = {}) => ({ logicalThreads: 28, cpuBusy: 0.42,
  totalRamBytes: 64 * 1024 ** 3, freeRamBytes: 30 * 1024 ** 3, ...overrides });
const choose = sample => resolveTestConcurrency(undefined, { hostSample: () => sample });

test('a partly busy 28-thread host admits eight files and retains measured budgets', () => {
  const sample = host();
  const result = choose(sample);
  assert.equal(result.concurrency, 8);
  assert.equal(result.cpuLimit, 8);
  assert.equal(result.ramLimit, 11);
  assert.deepEqual(result.sample, sample);
});

test('an idle large host stays within the file cap', () => {
  assert.equal(choose(host({ cpuBusy: 0, freeRamBytes: 60 * 1024 ** 3 })).concurrency, 12);
});

test('RAM pressure reduces concurrency despite spare CPU', () => {
  assert.equal(choose(host({ cpuBusy: 0, freeRamBytes: 11 * 1024 ** 3 })).concurrency, 2);
});

test('CPU contention reduces concurrency despite spare RAM', () => {
  assert.equal(choose(host({ cpuBusy: 0.75 })).concurrency, 3);
  assert.equal(choose(host({ cpuBusy: 1 })).concurrency, 1);
});

test('a small host and memory below the reserve run one file', () => {
  assert.equal(choose(host({ logicalThreads: 2, cpuBusy: 0, totalRamBytes: 8 * 1024 ** 3, freeRamBytes: 6 * 1024 ** 3 })).concurrency, 1);
  assert.equal(choose(host({ freeRamBytes: 0 })).concurrency, 1);
});

test('missing, invalid or unreadable resource evidence visibly falls back to one', () => {
  for (const sample of [null, {}, host({ cpuBusy: Number.NaN }), host({ logicalThreads: 0 }),
    host({ logicalThreads: 2.5 }), host({ cpuBusy: -1 }), host({ cpuBusy: 2 }),
    host({ freeRamBytes: -1 }), host({ freeRamBytes: 65 * 1024 ** 3 })]) {
    const result = choose(sample);
    assert.equal(result.concurrency, 1);
    assert.match(result.reason, /measurements unavailable/);
  }
  assert.match(resolveTestConcurrency(undefined, { hostSample: () => { throw new Error('probe unavailable'); } }).reason, /measurements unavailable/);
});

test('an explicit limit bypasses the host probe and rejects invalid integers', () => {
  assert.deepEqual(resolveTestConcurrency(16, { hostSample: () => { throw new Error('must not sample'); } }), { concurrency: 16, mode: 'explicit' });
  for (const value of [0, -1, 1.5, Number.NaN, Infinity, '4']) assert.throws(() => resolveTestConcurrency(value), /positive integer/);
});

test('the generated CLI leaves an omitted concurrency unset and forwards an explicit override', () => {
  const verb = CATALOG.groups.test.verbs.run;
  const automatic = validateArgs(['--level', 'L1'], verb);
  assert.equal(automatic.ok, true);
  assert.equal(automatic.args.concurrency, undefined);
  const explicit = validateArgs(['--level', 'L1', '--concurrency', '6'], verb);
  assert.equal(explicit.ok, true);
  assert.equal(explicit.args.concurrency, 6);
});
