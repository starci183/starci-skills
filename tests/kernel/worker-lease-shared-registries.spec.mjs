// Worker file leases over the shared registries (scripts/supervisor/workers.mjs leasable / leaseConflicts):
// the contract-changes DIRECTORY is as unleased as its one-per-change entry files. Every brief names the bare
// path modules/kernel/contract-changes, and a lease taken on it serialized every contract job behind its holder
// (cluster worker-lease-contract-changes-dir, 2026-09-30: fix-report-event-payload-v2-f42b1c held the bare dir
// until 2026-10-07 and two queued jobs starved with free slots). A lease row a finished job left on the
// directory blocks nobody either. The guard's write allowance derives from payload.files, never from
// sup_leases, so the worker still owns the directory in its staging checkout and writes its own entry file.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJob, spawnWorkers, leaseConflicts, workerGuard } from '../../scripts/supervisor/workers.mjs';
import { openMachine } from '../../engine/db/machine.mjs';
import { CONTRACT_CHANGES_DIR } from '../../scripts/kernel/contract-changes-store.mjs';

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

test('the contract-changes directory is never leased: jobs naming it do not conflict, and a stale lease row on it blocks nobody', async (t) => {
  const env = envOf();
  const m = openMachine({ env });
  t.after(() => m.close());
  // The 2026-09-30 evidence: a reported job still holds a sup_leases row on the bare directory.
  const holder = createJob(m, { cluster: 'report-event-payload', files: [CONTRACT_CHANGES_DIR] });
  m.acquireSupLeases(holder.job.job_id, [CONTRACT_CHANGES_DIR], { ttlMs: 7 * 24 * 3600_000 });
  m.setSupJobStatus(holder.job.job_id, 'reported');
  const a = createJob(m, { cluster: 'contract-a', files: [CONTRACT_CHANGES_DIR, 'scripts/contract-a.mjs'] });
  const b = createJob(m, { cluster: 'contract-b', files: [`${CONTRACT_CHANGES_DIR}/`, 'scripts/contract-b.mjs'] });
  const into = { guards: [], spawned: [], stagingRoot: tmp('wl-stage-') };
  const r = await spawnWorkers(m, { settings, env, deps: fakeDeps(into) });
  assert.deepEqual(r.skipped, [], JSON.stringify(r.skipped));
  assert.deepEqual(r.launched.map((l) => l.jobId).sort(), [a.job.job_id, b.job.job_id].sort());
  // Neither spelling leased the directory; only their real files are held.
  const leased = m.supLeases().filter((l) => [a.job.job_id, b.job.job_id].includes(l.job_id)).map((l) => l.path);
  assert.deepEqual(leased.sort(), ['scripts/contract-a.mjs', 'scripts/contract-b.mjs']);
  // The stale row on the bare directory is invisible to the lease check, and so is one on an entry file.
  assert.deepEqual(leaseConflicts(m, [CONTRACT_CHANGES_DIR]), []);
  assert.deepEqual(leaseConflicts(m, [`${CONTRACT_CHANGES_DIR}/new-entry.yaml`]), []);
  // The guard still owns the directory in each staging checkout: the worker writes its new entry file there
  // (an owned directory covers its subtree - scripts/guards/verify-commit.mjs foreignPathsOf).
  for (const g of into.guards) {
    const owned = g.owned.map((o) => path.relative(into.stagingRoot, o).replaceAll('\\', '/'));
    assert.ok(owned.some((p) => p.endsWith(`/${CONTRACT_CHANGES_DIR}`)), JSON.stringify(owned));
  }
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
