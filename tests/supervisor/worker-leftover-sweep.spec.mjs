import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMachine } from '../../engine/db/machine.mjs';
import { createJob, jobOf } from '../../scripts/supervisor/workers.mjs';
import { sweepWorkers } from '../../scripts/supervisor/supervisor-watchdog.mjs';

const machineOf = (t, status) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sup-leftover-'));
  const m = openMachine({ env: { STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') } });
  t.after(() => { m.close(); fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  const { job } = createJob(m, { cluster: 'leak', files: ['scripts/leak.mjs'] });
  m.startSupAttempt({ jobId: job.job_id, agent: 'claude', terminalHandle: 'term_leak' });
  m.setSupJobStatus(job.job_id, status, { payload: { ...job.payload, dispatch: 'ctx_leak' } });
  return { m, jobId: job.job_id };
};

test('a cancelled worker whose terminal close was never proven is closed again by the sweep', (t) => {
  const { m, jobId } = machineOf(t, 'cancelled');
  const calls = [];
  const d = { closeLeftover: (_m, args) => { calls.push(args.jobId); return { ok: true }; } };
  const out = sweepWorkers(m, d, { now: 1_000 });
  assert.deepEqual(calls, [jobId]);
  assert.deepEqual(out.closed, [{ jobId, handle: 'term_leak', leftover: true }]);
});

test('an unproven close is retried on the budget with its named reason, then left once the budget is spent', (t) => {
  const { m, jobId } = machineOf(t, 'failed');
  let calls = 0;
  const d = { closeLeftover: () => { calls += 1; return { ok: false, reason: 'terminal-still-connected' }; } };
  let now = 1_000;
  const first = sweepWorkers(m, d, { now });
  assert.equal(first.unclosed[0].reason, 'terminal-still-connected');
  assert.equal(calls, 1);
  assert.equal(sweepWorkers(m, d, { now: now + 1_000 }).unclosed, undefined, 'not due before its interval');
  assert.equal(calls, 1);
  for (let attempt = 2; attempt <= 12; attempt += 1) { now += 10 * 60 * 60_000; sweepWorkers(m, d, { now }); }
  assert.equal(calls, 12);
  assert.equal(jobOf(m, jobId).payload.closeRetry.exhausted, 'attempts');
  now += 10 * 60 * 60_000;
  assert.equal(sweepWorkers(m, d, { now }).unclosed, undefined, 'a spent budget stops the retries');
  assert.equal(calls, 12);
});

test('a running worker is left alone', (t) => {
  const { m } = machineOf(t, 'running');
  assert.deepEqual(sweepWorkers(m, { closeLeftover: () => assert.fail('a running worker is never swept') }, { now: 1 }), { deaths: [], closed: [] });
});
