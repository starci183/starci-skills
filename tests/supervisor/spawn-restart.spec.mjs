// A worker launch whose start answered an uncertain effect holds its job in `spawning` with the job's path leases. When the host
// restarts after the launch began, the launch is over: the job fails and its leases are freed. Live shape (2026-10-08):
// fix-liveness-reads-working-op-idle-e8734a stayed spawning with seven leases, no Dispatch and no terminal, and nothing repaired it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMachine } from '../../engine/db/machine.mjs';
import { createJob, jobOf, leaseConflicts, spawnWorkers } from '../../scripts/supervisor/workers.mjs';

const settings = { workers: { base: 1, max: 1 } };
const FILE = 'scripts/restart.mjs';
const host = (bootAt) => ({ status: () => ({ reachable: true, appPid: 1 }), table: () => [{ pid: 1, created: null }], bootAt: () => bootAt });
function world(t, { dispatchId = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-spawn-restart-'));
  const env = { STARCI_LOCAL_ROOT: dir, STARCI_TEST_MACHINE_FILE: path.join(dir, 'machine.sqlite') };
  const m = openMachine({ env });
  t.after(() => { m.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const job = createJob(m, { cluster: 'restart', files: [FILE] }).job;
  const deps = {
    load: () => ({ cpuBusy: 0, freeMem: 1 }),
    route: async () => ({ pool: 'codex-agent', agent: 'codex', model: 'gpt-6.1-sol' }),
    staging: () => ({ ok: true, path: dir, branch: 'fixture', base: 'abc', orcaId: 'fixture' }),
    guard: () => ({ receipt: { jobFile: 'guard.json' } }),
    start: () => ({ ok: false, step: 'worker-start', effectState: 'unknown', dispatchId, terminal: null, details: { outcome: 'outcome_unknown' } }),
    workerShow: () => ({ ok: false, error: 'dispatch_not_found: Worker Dispatch was not found.' }),
    sleep: () => {},
  };
  return { m, env, job, deps, spawn: () => spawnWorkers(m, { env, settings, deps }) };
}

test('a spawning job with no recorded Dispatch fails and frees its leases once the host restarted after the launch', async (t) => {
  const fx = world(t);
  await fx.spawn();
  assert.equal(jobOf(fx.m, fx.job.job_id).status, 'spawning');
  assert.ok(leaseConflicts(fx.m, [FILE], 'other').length, 'the launch holds the path');
  fx.deps.host = host(Date.now() + 3_600_000);
  const result = await fx.spawn();
  const settled = jobOf(fx.m, fx.job.job_id);
  assert.equal(settled.status, 'failed');
  assert.equal(settled.payload.result.reason, 'host-restarted');
  assert.deepEqual(leaseConflicts(fx.m, [FILE], 'other'), []);
  assert.equal(result.failed[0].jobId, fx.job.job_id);
});

test('a recorded Dispatch the running Orca does not know is dead after a restart, and alive without one', async (t) => {
  const fx = world(t, { dispatchId: 'ctx_gone' });
  await fx.spawn();
  fx.deps.host = host(0);
  await fx.spawn();
  assert.equal(jobOf(fx.m, fx.job.job_id).status, 'spawning', 'no restart proof: the launch keeps its custody');
  fx.deps.host = host(Date.now() + 3_600_000);
  await fx.spawn();
  assert.equal(jobOf(fx.m, fx.job.job_id).status, 'failed');
});

test('an Orca that does not answer keeps the uncertain launch held', async (t) => {
  const fx = world(t);
  await fx.spawn();
  fx.deps.host = { status: () => ({ reachable: false }), bootAt: () => Date.now() + 3_600_000 };
  await fx.spawn();
  assert.equal(jobOf(fx.m, fx.job.job_id).status, 'spawning');
  assert.ok(leaseConflicts(fx.m, [FILE], 'other').length);
});
