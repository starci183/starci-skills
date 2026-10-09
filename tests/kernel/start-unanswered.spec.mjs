// A Kernel start that prints no answer (killed at its bound) used to reach the Host as `restart-failed` with an empty detail. It now carries its cause and the phase it stood in,
// and the rotation that would close a working seat waits while the start is held.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startAnswerOf, unansweredStart } from '../../scripts/kernel/kernel-watchdog.mjs';
import { createKernelRotation } from '../../scripts/kernel/seat-rotation.mjs';

test('a start killed at its bound is a start-timeout naming its last phase; one that ended silently is start-no-answer; neither is an empty detail', () => {
  const killed = { ok: false, status: null, timedOut: true, value: null, stdout: '', stderr: 'start-workflow: phase sender\nstart-workflow: phase workflow-host', error: 'spawnSync node ETIMEDOUT' };
  assert.deepEqual(unansweredStart(killed), { ok: false, step: 'start-workflow', reason: 'start-timeout', error: 'start-workflow: phase sender | start-workflow: phase workflow-host', timedOut: true });
  const silent = unansweredStart({ ok: false, status: 3, timedOut: false, value: null, stdout: '', stderr: '', error: null });
  assert.deepEqual([silent.reason, silent.error], ['start-no-answer', 'start-workflow ended (exit 3) without an answer']);
  const answer = startAnswerOf(killed, { workflowId: 'wf-1' });
  assert.equal(answer.action, 'restart-failed');
  assert.notEqual(answer.detail, '');
  assert.equal(answer.detail.reason, 'start-timeout');
  assert.equal(startAnswerOf({ ok: true, value: { ok: true, terminal: 't' } }).action, 'restarted', 'an answered start is untouched');
});

test('the rotation closes the seat only when a start may run: a held start leaves it, a free one closes it and starts', () => {
  const calls = [];
  const make = (hold) => createKernelRotation({ workflowId: 'wf-1', openLedger: (fn) => fn({ transaction: (inner) => inner(), appendEvent: () => calls.push('event'), db: { prepare: () => ({ get: () => ({}), all: () => [] }) } }),
    close: () => { calls.push('close'); return { ok: true }; }, replace: () => { calls.push('replace'); return { action: 'restarted' }; }, sender: () => ({ ok: true }), hold });
  const input = { phase: 'running', terminal: 't', dispatch: 'd', outputAgeMs: 1, rotation: { due: true, reason: 'contract-changed: x' } };
  const held = make(() => ({ state: 'backoff', count: 2, step: 'start-workflow', reason: 'start-timeout' })).rotate(input);
  assert.equal(held.action, 'replacement-held');
  assert.deepEqual(calls, [], 'nothing was closed, recorded or started');
  assert.equal(make(() => null).rotate(input).action, 'rotated');
  assert.deepEqual(calls, ['close', 'event', 'replace']);
});
