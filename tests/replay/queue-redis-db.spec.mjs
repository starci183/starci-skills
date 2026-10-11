// The real authored adapter must pass the current DB-7 unit assertions at both Queue and Worker effect boundaries.
// Redis scheduler/reset isolation remains covered by the unchanged integration gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayQueueRedisDb } from '../helpers/replay-queue-redis-db.mjs';

test('the authored queue adapter preserves a nonzero Redis DB for both queue and worker', t => {
  const { run, result } = replayQueueRedisDb(t);
  assert.equal(run.error ?? null, null, run.stderr || run.stdout);
  assert.equal(run.signal ?? null, null, run.stderr || run.stdout);
  assert.equal(run.status, 0, `the authored adapter must pass Queue and Worker DB-7 assertions: ${run.stdout}${run.stderr}`);
  assert.ok(result, 'the real Jest run must produce its result document');
  assert.ok(result.numTotalTests > 0, 'the authored adapter spec must execute tests');
  assert.equal(result.numPassedTests, result.numTotalTests);
  assert.equal(result.numFailedTests, 0);
  assert.equal(result.numPendingTests, 0);
  assert.equal(result.success, true);
});
