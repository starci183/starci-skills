import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hostWideDisconnectOf, HOST_EVENT_WINDOW_MS } from '../scripts/kernel/host-event.mjs';
import { aggregate, failureClassOf } from '../scripts/supervisor/op-metrics.mjs';

const NOW = Date.parse('2026-09-27T13:29:00Z');
const MIN = 60_000;
const eventsDb = (file = ':memory:') => {
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE events(workflow_id TEXT, kind TEXT, payload_json TEXT, created_at INTEGER)');
  return db;
};
const clear = (db, workflow, at, reason = 'terminal disconnected') => db.prepare('INSERT INTO events VALUES(?,?,?,?)')
  .run(workflow, 'kernel-stale-cleared', JSON.stringify({ reason }), at);
const failedWorker = (environment = null) => ({ status: 'failed', result: {
  verdict: 'fail', reason: 'failed-no-report', worker: { liveness: 'gone' },
  ...(environment ? { environment, retryClass: 'environment', attemptConsumed: false } : { attemptConsumed: true }),
} });

test('two Kernel clears in one ledger and one in another make a worker death an environment failure', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-cross-ledger-wipe-'));
  const repo = path.join(dir, 'peer');
  fs.mkdirSync(path.join(repo, '.starciwork'), { recursive: true });
  const local = eventsDb();
  const peer = eventsDb(path.join(repo, '.starciwork', 'runtime.sqlite'));
  t.after(() => { local.close(); peer.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  clear(local, 'wf-nivo-a', NOW - 9 * MIN);
  clear(local, 'wf-nivo-b', NOW - 6 * MIN, 'terminal_handle_stale');
  clear(peer, 'wf-next-a', NOW - 2 * MIN, 'terminal disconnected (exited)');
  clear(peer, 'wf-old', NOW - HOST_EVENT_WINDOW_MS - MIN);
  clear(peer, 'wf-quiet', NOW - MIN, 'kernel quiet 45m');

  const wide = hostWideDisconnectOf(local, NOW, { repos: [repo] });
  assert.deepEqual(wide?.sort(), ['wf-next-a', 'wf-nivo-a', 'wf-nivo-b']);
  const death = failedWorker(wide ? 'host-terminal-wipe' : null);
  assert.equal(death.result.attemptConsumed, false);
  assert.equal(failureClassOf(death), 'environment:host-terminal-wipe');

  const health = aggregate([{ jobId: 'op-dead', workflowId: 'wf-nivo-a', op: 'backend.implement', outcome: 'failed',
    failureClass: failureClassOf(death), dead: true, dispatchedAt: NOW - MIN, retryOf: null,
    queueWaitMs: null, runMs: null, settleMs: null, ownerWaitMs: null, throttleMs: null }], { now: NOW, windowMs: HOST_EVENT_WINDOW_MS });
  assert.equal(health.totals.topFailureClass, 'environment:host-terminal-wipe');
  assert.equal(health.totals.deadWorkerRate, 1, 'raw terminal death is still measured');
});

test('a lone worker death without host evidence remains a dead worker', (t) => {
  const db = eventsDb();
  t.after(() => db.close());
  assert.equal(hostWideDisconnectOf(db, NOW, { repos: [] }), null);
  const death = failedWorker();
  assert.equal(death.result.attemptConsumed, true);
  assert.equal(failureClassOf(death), 'dead-worker:gone');
});
