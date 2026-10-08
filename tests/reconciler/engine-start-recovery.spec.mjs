// A new engine process settles what the previous one left: parked queue keys get a fresh retry budget and the provider receipts the
// host restart ended are released. Live shape (2026-10-08): host ledger:* keys parked after 60 attempts and seat:supervisor after 24,
// untouched by a resync, stayed parked through a reboot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkQueue, memoryRows } from '../../scripts/reconciler/workqueue.mjs';
import { startRecovery } from '../../scripts/reconciler/engine-process.mjs';

const parkedQueue = () => {
  let clock = 1_000;
  const queue = new WorkQueue({ rows: memoryRows(), now: () => clock, backoff: { minMs: 1, maxMs: 2, maxAttempts: 3 } });
  queue.add('host', 'seat:supervisor', { reason: 'resync' });
  queue.add('host', 'ledger:one', { reason: 'resync' });
  queue.add('host', 'service:orca', { reason: 'resync' });
  for (const key of ['seat:supervisor', 'ledger:one']) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      queue.take('host', 5);
      queue.failed('host', key, new Error('launch-failed'));
      clock += 10_000;
    }
  }
  queue.done('host', 'service:orca');
  queue.add('host', 'service:orca', { reason: 'resync' });
  return { queue, now: () => clock };
};
const fakeEngine = (queue) => {
  const lines = [];
  return { queue, lines, log: (kind, message, data) => lines.push({ kind, message, data }) };
};

test('a resync leaves a parked key parked, a new engine process re-arms it with a fresh budget', () => {
  const { queue, now } = parkedQueue();
  assert.equal(queue.rows.get('host', 'seat:supervisor').due_at, null);
  queue.add('host', 'seat:supervisor', { reason: 'resync' });
  assert.equal(queue.rows.get('host', 'seat:supervisor').due_at, null, 'a resync names no new event');
  const rearmed = queue.rearmParked();
  assert.deepEqual(rearmed.sort(), ['host ledger:one', 'host seat:supervisor']);
  const row = queue.rows.get('host', 'seat:supervisor');
  assert.deepEqual([row.due_at, row.tries, row.last_error], [now(), 0, null]);
  assert.equal(queue.rows.get('host', 'service:orca').reason, 'resync', 'a key that was not parked is untouched');
  assert.deepEqual(queue.take('host', 5).map((item) => item.key).sort(), ['ledger:one', 'seat:supervisor', 'service:orca']);
});

test('engine start releases the host restart receipts and re-arms the parked keys, and says so', () => {
  const { queue } = parkedQueue();
  const engine = fakeEngine(queue);
  const reaped = { released: [{ id: 'r1', why: 'host-restarted' }], kept: [], held: [] };
  startRecovery(engine, { reevaluated: false }, { reap: () => reaped });
  assert.deepEqual(engine.lines.map((line) => line.data.kind), ['reconciler.provider-receipts-released', 'reconciler.queue-rearmed']);
  assert.deepEqual(engine.lines[1].data.keys.sort(), ['host ledger:one', 'host seat:supervisor']);
});

test('a recovery step that throws is logged with its step and the next step still runs', () => {
  const { queue } = parkedQueue();
  const engine = fakeEngine(queue);
  startRecovery(engine, { reevaluated: false }, { reap: () => { throw new Error('census down'); } });
  assert.deepEqual(engine.lines.map((line) => [line.data.kind, line.data.step]), [['reconciler.start-recovery-failed', 'provider-receipts'], ['reconciler.queue-rearmed', undefined]]);
});
