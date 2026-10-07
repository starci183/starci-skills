import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRetry, retryAfterFailure } from '../../scripts/lib/retry-budget.mjs';

test('the interval doubles up to its ceiling and every step names its reason', () => {
  const budget = { intervalMs: 1000, maxIntervalMs: 4000 };
  const delays = [1, 2, 3, 4].map((attempts) => nextRetry(budget, { attempts, now: 0, reason: 'rate-limited' }).delayMs);
  assert.deepEqual(delays, [1000, 2000, 4000, 4000]);
  assert.equal(nextRetry(budget, { attempts: 1, now: 10, reason: 'lock-held' }).reason, 'lock-held');
  assert.equal(nextRetry({ intervalMs: 500 }, { attempts: 3, now: 0, reason: 'lock-held' }).delayMs, 500, 'a budget with one interval keeps it');
});

test('a spent attempt count or deadline ends the budget without a due time', () => {
  const byAttempts = nextRetry({ intervalMs: 1000, maxAttempts: 3 }, { attempts: 3, now: 100, reason: 'resource-floor' });
  assert.deepEqual([byAttempts.retry, byAttempts.exhausted, byAttempts.dueAt], [false, 'attempts', null]);
  assert.equal(nextRetry({ intervalMs: 1000, maxAttempts: 3 }, { attempts: 2, now: 100, reason: 'resource-floor' }).dueAt, 1100);
  const byDeadline = nextRetry({ intervalMs: 1000, deadlineMs: 5000 }, { attempts: 1, firstAt: 0, now: 4500, reason: 'lock-held' });
  assert.deepEqual([byDeadline.retry, byDeadline.exhausted], [false, 'deadline']);
});

test('a delay the refusal itself named replaces the interval, and an unnamed reason is refused', () => {
  assert.equal(nextRetry({ intervalMs: 1000 }, { attempts: 5, now: 0, reason: 'rate-limited', retryAfterMs: 60_000 }).delayMs, 60_000);
  assert.throws(() => nextRetry({ intervalMs: 1000 }, { attempts: 1, now: 0, reason: '' }), /names the reason/);
  assert.throws(() => nextRetry({}, { attempts: 1, now: 0, reason: 'x' }), /positive intervalMs/);
});

test('a failure folds onto the record the caller kept', () => {
  const first = retryAfterFailure({ intervalMs: 1000, maxAttempts: 2 }, null, { now: 50, reason: 'lock-held' });
  assert.deepEqual([first.attempts, first.firstAt, first.retry], [1, 50, true]);
  const second = retryAfterFailure({ intervalMs: 1000, maxAttempts: 2 }, { attempts: first.attempts, firstAt: first.firstAt }, { now: 1050, reason: 'lock-held' });
  assert.deepEqual([second.attempts, second.firstAt, second.exhausted], [2, 50, 'attempts']);
});
