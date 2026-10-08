// The [Worker] guard (scripts/supervisor/workers.mjs workerGuard): a worker owns its leased files as ABSOLUTE
// paths inside its staging checkout, so the command guard lets it stage and commit them (worker-guard-owned-empty:
// fix-autopilot-nested-tx-4a241a and fix-worker-spawn-quota-avoid-4d1388 had "owned": [] and could not commit).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { workerGuard, createJob, spawnWorkers } from '../../scripts/supervisor/workers.mjs';
import { openMachine } from '../../engine/db/machine.mjs';
import { guardLaunch } from '../../scripts/guards/hook-install.mjs';

const TEMP_DIRS = [];
after(() => { for (const dir of TEMP_DIRS) { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* still held */ } } });
const tmp = (prefix) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); TEMP_DIRS.push(dir); return dir; };
const envOf = () => { const root = tmp('worker-guard-'); return { STARCI_LOCAL_ROOT: path.join(root, 'la'), STARCI_SUPERVISOR_HOME: path.join(root, 'home'), STARCI_LANES_ROOT: path.join(root, 'lanes'), STARCI_SUPERVISOR_MODE: 'kernel', STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') }; };
const settings = { agent: 'claude', model: 'claude-opus-5-5', effort: 'high', repos: [], pollIntervalMs: 600000, language: 'vi', workers: { base: 4, max: 10 }, landGate: { mode: 'shared' } };
const fakeLaunch = (into) => (args) => { into.push(args); return { receipt: { jobFile: 'job.json' } }; };

test('workerGuard: owned = the leased files resolved absolute in the staging checkout, repos = [] (no history hook)', () => {
  const staging = path.join(tmp('wg-stage-'), 'fix-x');
  const launched = [];
  const guard = workerGuard('fix-x', { root: 'R', staging, files: ['scripts/supervisor/workers.mjs', 'tests/guards/worker-guard.spec.mjs', 'modules/ops/**'], launch: fakeLaunch(launched) });
  assert.equal(guard.receipt.jobFile, 'job.json');
  assert.equal(launched.length, 1);
  const args = launched[0];
  assert.equal(args.jobId, 'fix-x');
  assert.equal(args.skillRoot, 'R');
  assert.deepEqual(args.owned, [
    path.resolve(staging, 'scripts/supervisor/workers.mjs'),
    path.resolve(staging, 'tests/guards/worker-guard.spec.mjs'),
    path.resolve(staging, 'modules/ops'),
  ]);
  for (const p of args.owned) assert.ok(path.isAbsolute(p) && p.startsWith(path.resolve(staging)), p);
  assert.deepEqual(args.repos, []);
});

test('workerGuard: the real guardLaunch never installs a history hook for a worker (the staging checkout shares the live hooks dir)', () => {
  // A real repo: were the staging checkout in repos, ensureHistoryHook would write its reference-transaction hook here.
  const staging = tmp('wg-hook-');
  execFileSync('git', ['init', '-q', staging], { stdio: 'ignore' });
  const hooksDir = execFileSync('git', ['-C', staging, 'rev-parse', '--path-format=absolute', '--git-path', 'hooks'], { encoding: 'utf8' }).trim();
  const guard = workerGuard('fix-hook', { root: tmp('wg-root-'), staging, files: ['a.mjs'], launch: (args) => guardLaunch({ ...args, config: { guards: { historyHook: true } } }) });
  assert.deepEqual(guard.receipt.hooks, []);
  assert.ok(!fs.existsSync(path.join(hooksDir, 'reference-transaction')), hooksDir);
});

test('workerGuard: a failing launch returns the error on the receipt', () => {
  const guard = workerGuard('fix-y', { staging: tmp('wg-stage-'), files: ['a.mjs'], launch: () => { throw Error('boom'); } });
  assert.deepEqual(guard, { receipt: { error: 'boom' } });
});

test('spawnWorkers: the default guard call passes the job\'s leased files and its staging checkout', async (t) => {
  const env = envOf();
  const m = openMachine({ env });
  t.after(() => m.close());
  const job = createJob(m, { cluster: 'g1', files: ['scripts/g1.mjs', 'tests/g1.spec.mjs'] });
  const stagingPath = path.join(tmp('wg-stage-'), job.job.job_id);
  const launched = [], spawned = [], bound = [];
  const deps = {
    load: () => ({ cpuBusy: 0, freeMem: 1 }),
    route: async () => ({ pool: 'claude-agent', agent: 'claude', model: 'm' }),
    staging: ({ jobId }) => ({ ok: true, path: stagingPath, branch: `sup-${jobId}`, base: 'abc', orcaId: `repo::${jobId}` }),
    unstage: () => ({}), command: () => null,
    guard: (jobId, opts) => workerGuard(jobId, { ...opts, launch: fakeLaunch(launched) }),
    bindGuard: (args) => { bound.push(args); return 'bound.json'; },
    start: (opts) => { spawned.push(opts); opts.onCreated?.('term_g', 'ctx_g'); return { ok: true, terminal: 'term_g', dispatchId: 'ctx_g' }; },
  };
  await spawnWorkers(m, { settings, deps, env });
  assert.equal(spawned.length, 1);
  assert.equal('shims' in launched[0], false, 'worker-start owns the worker environment: the guard binds to its terminal');
  assert.deepEqual(bound.map((b) => [b.handle, b.jobFile]), [['term_g', 'job.json']], 'the job guard is bound to the worker terminal the command guard reads');
  assert.equal(launched[0].jobId, job.job.job_id);
  assert.deepEqual(launched[0].owned, [path.resolve(stagingPath, 'scripts/g1.mjs'), path.resolve(stagingPath, 'tests/g1.spec.mjs')]);
  assert.deepEqual(launched[0].repos, []);
});
