// Current canonical module paths participate in file leases; the existing grammar changelog remains append-only.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJob, spawnWorkers, leaseConflicts, workerGuard } from '../../scripts/supervisor/workers.mjs';
import { openMachine } from '../../engine/db/machine.mjs';

const TEMP_DIRS = [];
after(() => { for (const dir of TEMP_DIRS) { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* still held */ } } });
const tmp = (prefix) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); TEMP_DIRS.push(dir); return dir; };
const envOf = () => { const root = tmp('worker-lease-reg-'); return { LOCALAPPDATA: path.join(root, 'la'), STARCI_SUPERVISOR_HOME: path.join(root, 'home'), STARCI_LANES_ROOT: path.join(root, 'lanes'), STARCI_SUPERVISOR_MODE: 'kernel', STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') }; };
const settings = { agent: 'claude', model: 'claude-opus-5-5', effort: 'high', repos: [], pollIntervalMs: 600000, language: 'vi', workers: { base: 4, max: 10 }, landGate: { mode: 'shared', push: false } };

/** spawn deps: idle machine, a fixed route, a fake staging dir per job; captures guard launches and spawns. */
const fakeDeps = (into) => ({
  load: () => ({ cpuBusy: 0, freeMem: 1 }),
  route: async () => ({ pool: 'claude-agent', agent: 'claude', model: 'm' }),
  staging: ({ jobId }) => ({ ok: true, path: path.join(into.stagingRoot, jobId), branch: `sup-${jobId}`, base: 'abc', orcaId: `repo::${jobId}` }),
  unstage: () => ({}),
  guard: (jobId, opts) => workerGuard(jobId, { ...opts, launch: (args) => { into.guards.push(args); return { env: {}, pathPrefix: 'bin', receipt: {} }; } }),
  start: (opts) => { into.spawned.push(opts); return { ok: true, terminal: `term_${into.spawned.length}`, dispatchId: `ctx_${into.spawned.length}` }; },
});

test('a current module lease retains its exact owner and refuses a conflicting job', async (t) => {
  const env = envOf(), m = openMachine({ env });
  t.after(() => m.close());
  const file = 'modules/kernel/api.yaml';
  const holder = createJob(m, { cluster: 'current-holder', files: [file] });
  m.acquireSupLeases(holder.job.job_id, [file], { ttlMs: 7 * 24 * 3600_000 });
  const blocked = createJob(m, { cluster: 'current-conflict', files: [file] });
  const independent = createJob(m, { cluster: 'current-independent', files: ['modules/kernel/driver-loop.yaml'] });
  assert.deepEqual(leaseConflicts(m, [file]).map((row) => row.jobId), [holder.job.job_id]);
  const into = { guards: [], spawned: [], stagingRoot: tmp('wl-stage-') };
  const result = await spawnWorkers(m, { settings, env, deps: fakeDeps(into) });
  assert.ok(result.skipped.some((row) => row.jobId === blocked.job.job_id && /files leased by/.test(row.reason)), JSON.stringify(result));
  assert.ok(result.launched.some((row) => row.jobId === independent.job.job_id), JSON.stringify(result));
  assert.ok(!result.launched.some((row) => row.jobId === blocked.job.job_id));
  assert.ok(m.supLeases().some((row) => row.path === file && row.job_id === holder.job.job_id));
});

test('two jobs naming the same real file still conflict; the grammar changelog stays unleased', async (t) => {
  const env = envOf();
  const m = openMachine({ env });
  t.after(() => m.close());
  const a = createJob(m, { cluster: 'real-a', files: ['scripts/shared.mjs', 'packages/grammar/CHANGELOG.md'] });
  const b = createJob(m, { cluster: 'real-b', files: ['scripts/shared.mjs', 'packages/grammar/CHANGELOG.md'] });
  const into = { guards: [], spawned: [], stagingRoot: tmp('wl-stage-') };
  const r = await spawnWorkers(m, { settings, env, deps: fakeDeps(into) });
  assert.deepEqual(r.launched.map((l) => l.jobId), [a.job.job_id]);
  assert.ok(r.skipped.some((s) => s.jobId === b.job.job_id && /files leased by/.test(s.reason)), JSON.stringify(r.skipped));
  assert.deepEqual(leaseConflicts(m, ['scripts/shared.mjs']).map((c) => c.jobId), [a.job.job_id]);
  assert.equal(m.supLeases().filter((l) => l.path === 'packages/grammar/CHANGELOG.md').length, 0, 'the append-only changelog is never leased');
});
