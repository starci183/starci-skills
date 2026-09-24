import test from 'node:test';
import assert from 'node:assert/strict';
import { failureOnScreen } from '../scripts/agent/lib.mjs';

// nivo inc-7d452a3329ba, mia-mia inc-10f0777e39c1: a bare '401' in an id, a number or the runtime's own pasted
// Task was read as an auth failure and opened a 24 h provider circuit.
const card = { attestation: {}, knownFailures: [{ signal: 'Throttling\\.AllocationQuota' }] };

test('a 401 inside an id, an epoch or a token count is no failure', () => {
  for (const screen of [
    "Set-Location -LiteralPath 'C:\\staging\\fix-dispatch-attestation-false-401-8eb12e'",
    'observedAt 1790264010118',
    '↓ 14015 tokens · esc to interrupt',
  ]) assert.equal(failureOnScreen(card, screen), null, screen);
});

test("the runtime's own pasted Task is never failure evidence, even when it names an HTTP 401", () => {
  const task = 'Implement op-backend.implement-87c7aafa7f: a missing session is mapped to 401 Unauthorized (HTTP 401), never 403.';
  const screen = ['> Implement op-backend.implement-87c7aafa7f: a missing session is mapped to 401', 'Unauthorized (HTTP 401), never 403.', '✻ Thinking…'].join('\n');
  assert.equal(failureOnScreen(card, screen, task), null);
  assert.ok(failureOnScreen(card, screen), 'without the delivered text the same screen reads as a failure');
});

test('real auth failures and card-declared signals still fail', () => {
  assert.match(failureOnScreen(card, 'API Error: 401 Unauthorized')?.signal ?? '', /generic failure signature/);
  assert.match(failureOnScreen(card, 'Error: HTTP 401 from provider')?.signal ?? '', /generic failure signature/);
  assert.ok(failureOnScreen(card, 'Invalid API-key provided'));
  assert.equal(failureOnScreen(card, 'code: Throttling.AllocationQuota')?.signal, 'Throttling\\.AllocationQuota');
  const task = 'Handle Throttling.AllocationQuota in the client.';
  assert.equal(failureOnScreen(card, `> ${task}`, task), null, 'a pasted mention of a known failure is not the failure');
});
