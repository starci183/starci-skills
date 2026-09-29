// The [Worker] guard (scripts/supervisor/workers.mjs workerGuard): a worker owns its leased files as ABSOLUTE
// paths inside its staging checkout, so the git shim lets it stage and commit them (worker-guard-owned-empty:
// fix-autopilot-nested-tx-4a241a and fix-worker-spawn-quota-avoid-4d1388 had "owned": [] and could not commit).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { workerGuard, createJob, spawnWorkers } from '../scripts/supervisor/workers.mjs';
import { openMachine } from '../engine/machine-db.mjs';
import { guardLaunch } from '../scripts/guards/install.mjs';

const TEMP_DIRS = [];
after(() => { for (const dir of TEMP_DIRS) { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* still held */ } } });
const tmp = (prefix) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); TEMP_DIRS.push(dir); return dir; };
const envOf = () => { const root = tmp('worker-guard-'); return { LOCALAPPDATA: path.join(root, 'la'), STARCI_SUPERVISOR_HOME: path.join(root, 'home'), STARCI_LANES_ROOT: path.join(root, 'lanes'), STARCI_SUPERVISOR_MODE: 'kernel', STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite') }; };
const settings = { agent: 'claude', model: 'claude-opus-5-5', effort: 'high', repos: [], pollIntervalMs: 600000, language: 'vi', workers: { base: 4, max: 10 }, landGate: { mode: 'shared', push: false } };
const fakeLaunch = (into) => (args) => { into.push(args); return { env: {}, pathPrefix: 'bin', receipt: {} }; };

test('workerGuard: owned = the leased files resolved absolute in the staging checkout, repos = [] (no history hook)', () => {
  const staging = path.join(tmp('wg-stage-'), 'fix-x');
  const launched = [];
  const guard = workerGuard('fix-x', { root: 'R', staging, files: ['scripts/supervisor/workers.mjs', 'tests/worker-guard.spec.mjs', 'modules/ops/**'], launch: fakeLaunch(launched) });
  assert.equal(guard.pathPrefix, 'bin');
  assert.equal(launched.length, 1);
  const args = launched[0];
  assert.equal(args.jobId, 'fix-x');
  assert.equal(args.skillRoot, 'R');
  assert.deepEqual(args.owned, [
    path.resolve(staging, 'scripts/supervisor/workers.mjs'),
    path.resolve(staging, 'tests/worker-guard.spec.mjs'),
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
  const guard = workerGuard('fix-hook', { root: tmp('wg-root-'), staging, files: ['a.mjs'], launch: (args) => guardLaunch({ ...args, config: { guards: { shims: false, historyHook: true } } }) });
  assert.deepEqual(guard.receipt.hooks, []);
  assert.ok(!fs.existsSync(path.join(hooksDir, 'reference-transaction')), hooksDir);
});

test('workerGuard: a failing launch returns no path prefix and the error on the receipt', () => {
  const guard = workerGuard('fix-y', { staging: tmp('wg-stage-'), files: ['a.mjs'], launch: () => { throw Error('boom'); } });
  assert.equal(guard.pathPrefix, null);
  assert.equal(guard.receipt.error, 'boom');
});

test('spawnWorkers: the default guard call passes the job\'s leased files and its staging checkout', async (t) => {
  const env = envOf();
  const m = openMachine({ env });
  t.after(() => m.close());
  const job = createJob(m, { cluster: 'g1', files: ['scripts/g1.mjs', 'tests/g1.spec.mjs'] });
  const stagingPath = path.join(tmp('wg-stage-'), job.job.job_id);
  const launched = [], spawned = [];
  const deps = {
    load: () => ({ cpuBusy: 0, freeMem: 1 }),
    route: async () => ({ pool: 'claude-agent', agent: 'claude', model: 'm' }),
    staging: ({ jobId }) => ({ ok: true, path: stagingPath, branch: `sup/${jobId}`, base: 'abc' }),
    unstage: () => ({}), command: () => null,
    guard: (jobId, opts) => workerGuard(jobId, { ...opts, launch: fakeLaunch(launched) }),
    spawn: (opts) => { spawned.push(opts); return { ok: true, terminal: 'term_g' }; },
  };
  await spawnWorkers(m, { settings, deps, env });
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].pathPrefix, 'bin');
  assert.equal(launched[0].jobId, job.job.job_id);
  assert.deepEqual(launched[0].owned, [path.resolve(stagingPath, 'scripts/g1.mjs'), path.resolve(stagingPath, 'tests/g1.spec.mjs')]);
  assert.deepEqual(launched[0].repos, []);
});
